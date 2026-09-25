-- Staff notifications for Admin and Technician.
-- The existing notifications.customer_id column is used as the recipient user id
-- for all authenticated roles; RLS already limits reads/updates to auth.uid().

create or replace function public.notify_admins_new_product_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications
    (customer_id, type, title, message, reference_id, reference_type)
  select
    p.id,
    'order',
    'มีคำสั่งซื้อสินค้าใหม่',
    'มีคำสั่งซื้อใหม่ ' || coalesce(new.order_number, '') || ' เข้ามาในระบบ',
    new.id,
    'product_order'
  from public.profiles p
  where lower(coalesce(p.role, '')) = 'admin';

  return new;
end;
$$;

drop trigger if exists trg_notify_admins_new_product_order on public.product_orders;
create trigger trg_notify_admins_new_product_order
after insert on public.product_orders
for each row execute function public.notify_admins_new_product_order();

create or replace function public.notify_admins_new_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications
    (customer_id, type, title, message, reference_id, reference_type)
  select
    p.id,
    'booking',
    'มีการจองคิวใหม่',
    'มีการจองคิวใหม่จากลูกค้าเข้ามาในระบบ',
    new.id,
    'booking'
  from public.profiles p
  where lower(coalesce(p.role, '')) = 'admin';

  return new;
end;
$$;

drop trigger if exists trg_notify_admins_new_booking on public.bookings;
create trigger trg_notify_admins_new_booking
after insert on public.bookings
for each row execute function public.notify_admins_new_booking();

create or replace function public.notify_technician_repair_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.mechanic_id is null then
      return new;
    end if;
  elsif new.mechanic_id is null or new.mechanic_id is not distinct from old.mechanic_id then
    return new;
  end if;

  if new.mechanic_id is not null then
    insert into public.notifications
      (customer_id, type, title, message, reference_id, reference_type)
    values
      (
        new.mechanic_id,
        'repair',
        'มีงานซ่อมใหม่ที่ได้รับมอบหมาย',
        'Admin มอบหมายงานซ่อมใหม่ให้คุณ กรุณาเปิดรายละเอียดงานเพื่อดูข้อมูล',
        new.id,
        'repair_job'
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_technician_repair_assignment on public.repair_jobs;
create trigger trg_notify_technician_repair_assignment
after insert or update of mechanic_id on public.repair_jobs
for each row execute function public.notify_technician_repair_assignment();
