-- ยอดค่าซ่อมที่ลูกค้าต้องจ่าย = ราคาบริการ + ค่าอะไหล่ที่ช่างใช้ในงาน
-- รันใน Supabase SQL Editor (รันซ้ำได้) — แทนที่ฟังก์ชันเดิมจาก booking-payment-feature.sql

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
  parts_total numeric(10, 2);
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

  select coalesce(sum(total_price), 0) into parts_total
  from public.repair_job_parts
  where repair_job_id = target_work_order_id;

  update public.repair_jobs
  set
    status = 'completed',
    diagnosis = nullif(trim(diagnosis_text), ''),
    repair_notes = nullif(trim(repair_notes_text), ''),
    completed_at = now_ts,
    started_at = coalesce(job_record.started_at, now_ts),
    updated_at = now_ts
  where id = target_work_order_id
  returning * into job_record;

  update public.bookings
  set
    payment_status = 'awaiting_payment',
    payment_amount = coalesce(service_price, 0) + parts_total,
    updated_at = now_ts
  where id = booking_record.id;

  return job_record;
end;
$$;

grant execute on function public.complete_repair_job_and_request_payment(uuid, text, text)
to authenticated;
