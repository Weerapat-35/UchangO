-- อู่ช่างโอ: Customer Notification Center
-- แจ้งเตือนจะถูกแยกตาม customer_id และ RLS จะบังคับให้ลูกค้าเห็นเฉพาะของตัวเอง

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'system',
  title text not null,
  message text,
  reference_id uuid,
  reference_type text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_customer_created_idx
  on public.notifications(customer_id, created_at desc);

create index if not exists notifications_customer_unread_idx
  on public.notifications(customer_id, is_read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Customers can view own notifications" on public.notifications;
create policy "Customers can view own notifications"
on public.notifications
for select to authenticated
using (customer_id = auth.uid());

drop policy if exists "Customers can update own notifications" on public.notifications;
create policy "Customers can update own notifications"
on public.notifications
for update to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

-- ให้ backend/service role เป็นผู้สร้าง notification ไม่เปิด INSERT ให้ customer โดยตรง

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- แจ้งเตือนคำสั่งซื้อสินค้าเมื่อสร้างใหม่หรือสถานะเปลี่ยน
create or replace function public.notify_product_order_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_title text;
  notification_message text;
begin
  if tg_op = 'INSERT' then
    notification_title := 'ได้รับคำสั่งซื้อแล้ว';
    notification_message := 'คำสั่งซื้อ ' || coalesce(new.order_number, '') || ' ถูกบันทึกเรียบร้อยแล้ว';
  elsif new.status is distinct from old.status then
    notification_title := case new.status
      when 'confirmed' then 'ยืนยันคำสั่งซื้อแล้ว'
      when 'preparing' then 'กำลังเตรียมสินค้า'
      when 'out_for_delivery' then 'กำลังจัดส่งสินค้า'
      when 'ready_for_pickup' then 'สินค้าพร้อมรับแล้ว'
      when 'completed' then 'คำสั่งซื้อสำเร็จ'
      when 'cancelled' then 'คำสั่งซื้อถูกยกเลิก'
      else 'อัปเดตสถานะคำสั่งซื้อ'
    end;
    notification_message := 'คำสั่งซื้อ ' || coalesce(new.order_number, '') || ' เปลี่ยนเป็นสถานะ ' || coalesce(new.status, '');
  else
    return new;
  end if;

  insert into public.notifications
    (customer_id, type, title, message, reference_id, reference_type)
  values
    (new.customer_id, 'order', notification_title, notification_message, new.id, 'product_order');

  return new;
end;
$$;

drop trigger if exists trg_notify_product_order_customer on public.product_orders;
create trigger trg_notify_product_order_customer
after insert or update of status on public.product_orders
for each row execute function public.notify_product_order_customer();

-- แจ้งเตือนการจองเมื่อสร้างใหม่หรือสถานะเปลี่ยน
create or replace function public.notify_booking_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_title text;
  notification_message text;
begin
  if tg_op = 'INSERT' then
    notification_title := 'ส่งคำขอจองคิวแล้ว';
    notification_message := 'ระบบได้รับคำขอจองคิวของคุณแล้ว';
  elsif new.status is distinct from old.status then
    notification_title := case new.status
      when 'confirmed' then 'ยืนยันการจองคิวแล้ว'
      when 'completed' then 'การเข้ารับบริการเสร็จสิ้น'
      when 'cancelled' then 'การจองถูกยกเลิก'
      else 'อัปเดตสถานะการจอง'
    end;
    notification_message := 'สถานะการจองของคุณเปลี่ยนเป็น ' || coalesce(new.status, '');
  else
    return new;
  end if;

  insert into public.notifications
    (customer_id, type, title, message, reference_id, reference_type)
  values
    (new.customer_id, 'booking', notification_title, notification_message, new.id, 'booking');

  return new;
end;
$$;

drop trigger if exists trg_notify_booking_customer on public.bookings;
create trigger trg_notify_booking_customer
after insert or update of status on public.bookings
for each row execute function public.notify_booking_customer();
