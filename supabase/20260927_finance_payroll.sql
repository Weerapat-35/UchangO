-- ระบบการเงินและเงินเดือนช่างสำหรับอู่ช่างโอ
-- Run this migration in Supabase SQL Editor.

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null default current_date,
  transaction_type text not null check (transaction_type in ('income','expense')),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  description text,
  reference_type text,
  reference_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_transactions_date_idx
on public.finance_transactions(transaction_date desc);

create index if not exists finance_transactions_type_date_idx
on public.finance_transactions(transaction_type, transaction_date desc);

create unique index if not exists finance_transactions_reference_unique
on public.finance_transactions(reference_type, reference_id)
where reference_type is not null and reference_id is not null;

alter table public.finance_transactions enable row level security;

drop policy if exists finance_transactions_admin_select on public.finance_transactions;
create policy finance_transactions_admin_select
on public.finance_transactions
for select to authenticated
using (public.current_user_is_admin());

drop policy if exists finance_transactions_admin_insert on public.finance_transactions;
create policy finance_transactions_admin_insert
on public.finance_transactions
for insert to authenticated
with check (public.current_user_is_admin());

drop policy if exists finance_transactions_admin_update on public.finance_transactions;
create policy finance_transactions_admin_update
on public.finance_transactions
for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists finance_transactions_admin_delete on public.finance_transactions;
create policy finance_transactions_admin_delete
on public.finance_transactions
for delete to authenticated
using (public.current_user_is_admin());


create table if not exists public.technician_payrolls (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.profiles(id) on delete cascade,
  payroll_month date not null,
  base_salary numeric(12,2) not null default 0 check (base_salary >= 0),
  overtime_amount numeric(12,2) not null default 0 check (overtime_amount >= 0),
  commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  deduction_amount numeric(12,2) not null default 0 check (deduction_amount >= 0),
  net_salary numeric(12,2) not null default 0 check (net_salary >= 0),
  status text not null default 'draft' check (status in ('draft','paid')),
  paid_at timestamptz,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (technician_id, payroll_month)
);

create index if not exists technician_payrolls_month_idx
on public.technician_payrolls(payroll_month desc);

create index if not exists technician_payrolls_technician_idx
on public.technician_payrolls(technician_id);

alter table public.technician_payrolls enable row level security;

drop policy if exists technician_payrolls_admin_select on public.technician_payrolls;
create policy technician_payrolls_admin_select
on public.technician_payrolls
for select to authenticated
using (public.current_user_is_admin());

drop policy if exists technician_payrolls_admin_insert on public.technician_payrolls;
create policy technician_payrolls_admin_insert
on public.technician_payrolls
for insert to authenticated
with check (public.current_user_is_admin());

drop policy if exists technician_payrolls_admin_update on public.technician_payrolls;
create policy technician_payrolls_admin_update
on public.technician_payrolls
for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists technician_payrolls_admin_delete on public.technician_payrolls;
create policy technician_payrolls_admin_delete
on public.technician_payrolls
for delete to authenticated
using (public.current_user_is_admin());


-- รายรับจากการชำระค่าบริการ
create or replace function public.sync_booking_payment_finance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid' then
    insert into public.finance_transactions
      (transaction_date, transaction_type, category, amount, description, reference_type, reference_id)
    values
      (
        coalesce((new.paid_at at time zone 'Asia/Bangkok')::date, current_date),
        'income',
        'ค่าบริการซ่อม',
        new.amount,
        'รายรับจากการชำระค่าบริการ',
        'booking_payment',
        new.id
      )
    on conflict (reference_type, reference_id)
    where finance_transactions.reference_type is not null
      and finance_transactions.reference_id is not null
    do update set
      transaction_date = excluded.transaction_date,
      amount = excluded.amount,
      updated_at = now();
  elsif tg_op = 'UPDATE' and old.payment_status = 'paid' then
    delete from public.finance_transactions
    where reference_type = 'booking_payment' and reference_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_booking_payment_finance on public.booking_payments;
create trigger trg_sync_booking_payment_finance
after insert or update of payment_status, paid_at, amount on public.booking_payments
for each row execute function public.sync_booking_payment_finance();


-- รายรับจากคำสั่งซื้อสินค้า
create or replace function public.sync_product_payment_finance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid' then
    insert into public.finance_transactions
      (transaction_date, transaction_type, category, amount, description, reference_type, reference_id)
    values
      (
        coalesce((new.paid_at at time zone 'Asia/Bangkok')::date, current_date),
        'income',
        'ขายสินค้า',
        new.amount,
        'รายรับจากคำสั่งซื้อสินค้า',
        'product_payment',
        new.id
      )
    on conflict (reference_type, reference_id)
    where finance_transactions.reference_type is not null
      and finance_transactions.reference_id is not null
    do update set
      transaction_date = excluded.transaction_date,
      amount = excluded.amount,
      updated_at = now();
  elsif tg_op = 'UPDATE' and old.payment_status = 'paid' then
    delete from public.finance_transactions
    where reference_type = 'product_payment' and reference_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_product_payment_finance on public.product_payments;
create trigger trg_sync_product_payment_finance
after insert or update of payment_status, paid_at, amount on public.product_payments
for each row execute function public.sync_product_payment_finance();


-- เมื่อเงินเดือนถูกจ่าย ให้บันทึกเป็นเงินออกอัตโนมัติ
create or replace function public.sync_payroll_finance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' then
    insert into public.finance_transactions
      (transaction_date, transaction_type, category, amount, description, reference_type, reference_id)
    values
      (
        coalesce((new.paid_at at time zone 'Asia/Bangkok')::date, current_date),
        'expense',
        'เงินเดือนช่าง',
        new.net_salary,
        'จ่ายเงินเดือนช่างประจำเดือน ' || to_char(new.payroll_month, 'MM/YYYY'),
        'technician_payroll',
        new.id
      )
    on conflict (reference_type, reference_id)
    where finance_transactions.reference_type is not null
      and finance_transactions.reference_id is not null
    do update set
      transaction_date = excluded.transaction_date,
      amount = excluded.amount,
      updated_at = now();
  elsif tg_op = 'UPDATE' and old.status = 'paid' then
    delete from public.finance_transactions
    where reference_type = 'technician_payroll' and reference_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_payroll_finance on public.technician_payrolls;
create trigger trg_sync_payroll_finance
after insert or update of status, paid_at, net_salary on public.technician_payrolls
for each row execute function public.sync_payroll_finance();


-- Backfill รายรับจากรายการชำระที่มีอยู่แล้ว
insert into public.finance_transactions
  (transaction_date, transaction_type, category, amount, description, reference_type, reference_id)
select
  coalesce((bp.paid_at at time zone 'Asia/Bangkok')::date, (bp.created_at at time zone 'Asia/Bangkok')::date),
  'income',
  'ค่าบริการซ่อม',
  bp.amount,
  'รายรับจากการชำระค่าบริการ',
  'booking_payment',
  bp.id
from public.booking_payments bp
where bp.payment_status = 'paid'
on conflict (reference_type, reference_id)
where finance_transactions.reference_type is not null
  and finance_transactions.reference_id is not null
do nothing;

insert into public.finance_transactions
  (transaction_date, transaction_type, category, amount, description, reference_type, reference_id)
select
  coalesce((pp.paid_at at time zone 'Asia/Bangkok')::date, (pp.created_at at time zone 'Asia/Bangkok')::date),
  'income',
  'ขายสินค้า',
  pp.amount,
  'รายรับจากคำสั่งซื้อสินค้า',
  'product_payment',
  pp.id
from public.product_payments pp
where pp.payment_status = 'paid'
on conflict (reference_type, reference_id)
where finance_transactions.reference_type is not null
  and finance_transactions.reference_id is not null
do nothing;
