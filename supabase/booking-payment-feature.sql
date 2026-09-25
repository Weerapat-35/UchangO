-- =========================================================================
-- BCare: ระบบจ่ายค่าซ่อม (Booking Payment)
-- =========================================================================
-- ทำอะไรบ้าง:
--   1) เพิ่มคอลัมน์ payment_status / payment_amount / picked_up_at ให้ bookings
--   2) สร้างตาราง booking_payments (ประวัติการอัปโหลดสลิปจ่ายค่าซ่อม)
--   3) สร้าง 5 ฟังก์ชันที่ควบคุม flow ทั้งหมด (ห้าม client .update() ตรงๆ):
--        - complete_repair_job_and_request_payment  (ช่างปิดงาน -> ขอเงินลูกค้า)
--        - submit_booking_payment_slip              (ลูกค้าอัปโหลดสลิป)
--        - approve_booking_payment                  (แอดมินอนุมัติ)
--        - reject_booking_payment                   (แอดมินปฏิเสธ)
--        - confirm_booking_pickup                   (ลูกค้ายืนยันรับรถ)
--   4) กันสลิปซ้ำ/อนุมัติซ้ำด้วย unique index บน provider_reference
--
-- Additive only: ไม่แตะ column/ค่าเดิมของ bookings หรือ repair_jobs เลย
-- ไม่ต้องสร้าง storage policy ใหม่ เพราะ bucket "payment-slips" ที่มีอยู่แล้ว
-- อนุญาตให้ผู้ใช้อ่าน/เขียนไฟล์ใต้โฟลเดอร์ <ของตัวเอง>/** อยู่แล้ว
-- (แนะนำ path ตอนอัปโหลดฝั่ง client: `${user.id}/bookings/${bookingId}-${timestamp}.jpg`)
--
-- รันทั้งไฟล์นี้รวดเดียวใน Supabase SQL Editor
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) เพิ่มคอลัมน์บน bookings
-- -------------------------------------------------------------------------
alter table public.bookings
add column if not exists payment_status text not null default 'not_required',
add column if not exists payment_amount numeric(10, 2),
add column if not exists picked_up_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_payment_status_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
    add constraint bookings_payment_status_check
      check (
        payment_status in (
          'not_required',
          'awaiting_payment',
          'pending_review',
          'paid',
          'rejected'
        )
      );
  end if;
end $$;

-- -------------------------------------------------------------------------
-- 2) ตาราง booking_payments
-- -------------------------------------------------------------------------
create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  payment_method text not null default 'bank_transfer',
  slip_image_url text not null,
  payment_status text not null default 'pending',
  rejected_reason text,
  submitted_at timestamptz not null default now(),
  paid_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  -- คอลัมน์สำหรับตรวจสลิปอัตโนมัติ (SlipOK) ต่อยอดได้ในอนาคต
  verification_status text not null default 'submitted',
  verification_provider text,
  provider_reference text,
  verification_response jsonb,
  slip_amount numeric(10, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_payments_payment_status_check'
      and conrelid = 'public.booking_payments'::regclass
  ) then
    alter table public.booking_payments
    add constraint booking_payments_payment_status_check
      check (payment_status in ('pending', 'paid', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_payments_payment_method_check'
      and conrelid = 'public.booking_payments'::regclass
  ) then
    alter table public.booking_payments
    add constraint booking_payments_payment_method_check
      check (payment_method in ('bank_transfer', 'promptpay'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_payments_verification_status_check'
      and conrelid = 'public.booking_payments'::regclass
  ) then
    alter table public.booking_payments
    add constraint booking_payments_verification_status_check
      check (verification_status in ('submitted', 'verified', 'rejected', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_payments_verification_provider_check'
      and conrelid = 'public.booking_payments'::regclass
  ) then
    alter table public.booking_payments
    add constraint booking_payments_verification_provider_check
      check (verification_provider is null or verification_provider in ('slipok', 'admin_manual'));
  end if;
end $$;

create index if not exists booking_payments_booking_idx
on public.booking_payments(booking_id);

create index if not exists booking_payments_customer_idx
on public.booking_payments(customer_id);

-- กันสลิปเดียวกัน (หรือการอนุมัติมือ) ถูกใช้ยืนยันซ้ำมากกว่า 1 รายการ
create unique index if not exists booking_payments_provider_reference_key
on public.booking_payments(provider_reference)
where provider_reference is not null;

alter table public.booking_payments enable row level security;

-- อ่านได้อย่างเดียวจากฝั่ง client ทุกการเขียนต้องผ่านฟังก์ชัน security definer ด้านล่าง
drop policy if exists "Customers can read own booking payments"
on public.booking_payments;
create policy "Customers can read own booking payments"
on public.booking_payments
for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "Admins can read all booking payments"
on public.booking_payments;
create policy "Admins can read all booking payments"
on public.booking_payments
for select
to authenticated
using (public.current_user_is_admin());

-- -------------------------------------------------------------------------
-- 3) ฟังก์ชัน 1: ช่างปิดงานซ่อม -> เปิดให้ลูกค้าจ่ายเงิน
-- -------------------------------------------------------------------------
create or replace function public.complete_repair_job_and_request_payment(
  target_work_order_id uuid,
  diagnosis_text text,
  repair_notes_text text
)
returns public.repair_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  job_record public.repair_jobs;
  booking_record public.bookings;
  service_price numeric(10, 2);
  now_ts timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบ';
  end if;

  select * into job_record
  from public.repair_jobs
  where id = target_work_order_id
  for update;

  if job_record is null then
    raise exception 'ไม่พบใบงานซ่อมนี้';
  end if;

  if job_record.mechanic_id is distinct from auth.uid() then
    raise exception 'ไม่มีสิทธิ์แก้ไขใบงานซ่อมนี้';
  end if;

  if job_record.status in ('completed', 'cancelled') then
    raise exception 'ใบงานซ่อมนี้ปิดแล้ว ไม่สามารถแก้ไขได้';
  end if;

  select * into booking_record
  from public.bookings
  where id = job_record.booking_id
  for update;

  if booking_record is null then
    raise exception 'ไม่พบการจองของใบงานซ่อมนี้';
  end if;

  select base_price into service_price
  from public.services
  where id = booking_record.service_id;

  update public.repair_jobs
  set
    status = 'completed',
    diagnosis = diagnosis_text,
    repair_notes = repair_notes_text,
    completed_at = now_ts,
    started_at = coalesce(job_record.started_at, now_ts),
    updated_at = now_ts
  where id = target_work_order_id
  returning * into job_record;

  update public.bookings
  set
    payment_status = 'awaiting_payment',
    payment_amount = coalesce(service_price, 0),
    updated_at = now_ts
  where id = booking_record.id;

  return job_record;
end;
$$;

grant execute on function public.complete_repair_job_and_request_payment(uuid, text, text)
to authenticated;

-- -------------------------------------------------------------------------
-- 4) ฟังก์ชัน 2: ลูกค้าอัปโหลด (หรืออัปโหลดใหม่หลังโดนปฏิเสธ) สลิปจ่ายเงิน
-- -------------------------------------------------------------------------
create or replace function public.submit_booking_payment_slip(
  target_booking_id uuid,
  slip_url text,
  slip_payment_method text
)
returns public.booking_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_record public.bookings;
  payment_record public.booking_payments;
  now_ts timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบ';
  end if;

  select * into booking_record
  from public.bookings
  where id = target_booking_id
  for update;

  if booking_record is null then
    raise exception 'ไม่พบการจองนี้';
  end if;

  if booking_record.customer_id is distinct from auth.uid() then
    raise exception 'ไม่มีสิทธิ์เข้าถึงการจองนี้';
  end if;

  if booking_record.payment_status not in ('awaiting_payment', 'rejected') then
    raise exception 'การจองนี้ไม่ได้อยู่ในสถานะที่รอชำระเงิน';
  end if;

  if slip_url is null or length(trim(slip_url)) = 0 then
    raise exception 'ไม่พบไฟล์สลิป';
  end if;

  if slip_payment_method not in ('bank_transfer', 'promptpay') then
    slip_payment_method := 'bank_transfer';
  end if;

  select * into payment_record
  from public.booking_payments
  where booking_id = target_booking_id
    and payment_status in ('pending', 'rejected')
  order by created_at desc
  limit 1;

  if payment_record is null then
    insert into public.booking_payments (
      booking_id, customer_id, amount, payment_method, slip_image_url,
      payment_status, submitted_at, verification_status
    ) values (
      target_booking_id, auth.uid(), coalesce(booking_record.payment_amount, 0),
      slip_payment_method, slip_url, 'pending', now_ts, 'submitted'
    )
    returning * into payment_record;
  else
    update public.booking_payments
    set
      payment_method = slip_payment_method,
      slip_image_url = slip_url,
      payment_status = 'pending',
      rejected_reason = null,
      submitted_at = now_ts,
      verified_at = null,
      verified_by = null,
      verification_status = 'submitted',
      verification_provider = null,
      provider_reference = null,
      verification_response = null,
      slip_amount = null,
      updated_at = now_ts
    where id = payment_record.id
    returning * into payment_record;
  end if;

  update public.bookings
  set payment_status = 'pending_review', updated_at = now_ts
  where id = target_booking_id;

  return payment_record;
end;
$$;

grant execute on function public.submit_booking_payment_slip(uuid, text, text)
to authenticated;

-- -------------------------------------------------------------------------
-- 5) ฟังก์ชัน 3: แอดมินอนุมัติสลิป
-- -------------------------------------------------------------------------
create or replace function public.approve_booking_payment(
  target_booking_payment_id uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.booking_payments;
  booking_record public.bookings;
  now_ts timestamptz := now();
begin
  if not public.current_user_is_admin() then
    raise exception 'เฉพาะแอดมินเท่านั้น';
  end if;

  select * into payment_record
  from public.booking_payments
  where id = target_booking_payment_id
  for update;

  if payment_record is null then
    raise exception 'ไม่พบรายการชำระเงินนี้';
  end if;

  if payment_record.payment_status <> 'pending'
    or payment_record.verification_status <> 'submitted' then
    raise exception 'รายการนี้ถูกตรวจสอบไปแล้ว ไม่สามารถอนุมัติซ้ำได้';
  end if;

  begin
    update public.booking_payments
    set
      payment_status = 'paid',
      paid_at = now_ts,
      verified_at = now_ts,
      verified_by = auth.uid(),
      verification_status = 'verified',
      verification_provider = 'admin_manual',
      provider_reference = 'admin-manual:' || target_booking_payment_id::text,
      rejected_reason = null,
      updated_at = now_ts
    where id = target_booking_payment_id;
  exception
    when unique_violation then
      raise exception 'สลิปนี้เคยถูกใช้ยืนยันการชำระเงินสำเร็จไปแล้วในรายการอื่น';
  end;

  update public.bookings
  set payment_status = 'paid', updated_at = now_ts
  where id = payment_record.booking_id
  returning * into booking_record;

  return booking_record;
end;
$$;

grant execute on function public.approve_booking_payment(uuid)
to authenticated;

-- -------------------------------------------------------------------------
-- 6) ฟังก์ชัน 4: แอดมินปฏิเสธสลิป
-- -------------------------------------------------------------------------
create or replace function public.reject_booking_payment(
  target_booking_payment_id uuid,
  reason text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.booking_payments;
  booking_record public.bookings;
  now_ts timestamptz := now();
begin
  if not public.current_user_is_admin() then
    raise exception 'เฉพาะแอดมินเท่านั้น';
  end if;

  if reason is null or length(trim(reason)) = 0 then
    raise exception 'กรุณาระบุเหตุผลที่ปฏิเสธ';
  end if;

  select * into payment_record
  from public.booking_payments
  where id = target_booking_payment_id
  for update;

  if payment_record is null then
    raise exception 'ไม่พบรายการชำระเงินนี้';
  end if;

  if payment_record.payment_status <> 'pending'
    or payment_record.verification_status <> 'submitted' then
    raise exception 'รายการนี้ถูกตรวจสอบไปแล้ว ไม่สามารถปฏิเสธซ้ำได้';
  end if;

  update public.booking_payments
  set
    payment_status = 'rejected',
    rejected_reason = reason,
    verified_at = now_ts,
    verified_by = auth.uid(),
    verification_status = 'rejected',
    paid_at = null,
    updated_at = now_ts
  where id = target_booking_payment_id;

  update public.bookings
  set payment_status = 'rejected', updated_at = now_ts
  where id = payment_record.booking_id
  returning * into booking_record;

  return booking_record;
end;
$$;

grant execute on function public.reject_booking_payment(uuid, text)
to authenticated;

-- -------------------------------------------------------------------------
-- 7) ฟังก์ชัน 5: ลูกค้ายืนยันรับรถ (ต้องจ่ายเงินครบก่อน)
-- -------------------------------------------------------------------------
create or replace function public.confirm_booking_pickup(
  target_booking_id uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_record public.bookings;
  now_ts timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบ';
  end if;

  select * into booking_record
  from public.bookings
  where id = target_booking_id
  for update;

  if booking_record is null then
    raise exception 'ไม่พบการจองนี้';
  end if;

  if booking_record.customer_id is distinct from auth.uid() then
    raise exception 'ไม่มีสิทธิ์เข้าถึงการจองนี้';
  end if;

  if booking_record.payment_status is distinct from 'paid' then
    raise exception 'ต้องชำระเงินให้เรียบร้อยก่อนยืนยันรับรถ';
  end if;

  if booking_record.picked_up_at is not null then
    raise exception 'ยืนยันรับรถไปแล้ว';
  end if;

  update public.bookings
  set picked_up_at = now_ts, status = 'completed', updated_at = now_ts
  where id = target_booking_id
  returning * into booking_record;

  return booking_record;
end;
$$;

grant execute on function public.confirm_booking_pickup(uuid)
to authenticated;

-- =========================================================================
-- จบไฟล์ — รันครั้งเดียวจบ ปลอดภัยที่จะรันซ้ำได้ (idempotent)
-- =========================================================================
