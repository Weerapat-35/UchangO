-- บันทึกเงินออกอัตโนมัติ: ค่าสินค้าที่รับเข้าสต็อก + ค่าใช้จ่ายประจำเดือน
-- Run this migration in Supabase SQL Editor ก่อน deploy โค้ดเวอร์ชันที่ใช้ตารางเหล่านี้
-- ต้องรัน 20260927_finance_payroll.sql มาก่อนแล้ว (ตาราง finance_transactions)


-- ===== 1. รับเข้าสต็อก -> เงินออกหมวด "ค่าอะไหล่" =====

-- ราคาทุนต่อชิ้นของรายการรับเข้า (ว่าง = ไม่บันทึกเงินออก)
alter table public.inventory_movements
  add column if not exists unit_cost numeric(12,2)
  check (unit_cost is null or unit_cost >= 0);

create or replace function public.sync_inventory_purchase_finance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_name text;
begin
  if tg_op = 'DELETE' then
    delete from public.finance_transactions
    where reference_type = 'inventory_movement' and reference_id = old.id;
    return old;
  end if;

  if new.movement_type = 'stock_in' and coalesce(new.unit_cost, 0) > 0 then
    select name into v_product_name from public.products where id = new.product_id;

    insert into public.finance_transactions
      (transaction_date, transaction_type, category, amount, description, reference_type, reference_id, created_by)
    values
      (
        (new.created_at at time zone 'Asia/Bangkok')::date,
        'expense',
        'ค่าอะไหล่',
        round(new.quantity * new.unit_cost, 2),
        'รับเข้าสต็อก: ' || coalesce(v_product_name, 'สินค้า') || ' x ' || new.quantity
          || ' @ ' || to_char(new.unit_cost, 'FM999,999,990.00') || ' บาท',
        'inventory_movement',
        new.id,
        new.created_by
      )
    on conflict (reference_type, reference_id)
    where finance_transactions.reference_type is not null
      and finance_transactions.reference_id is not null
    do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_inventory_purchase_finance on public.inventory_movements;
create trigger trg_sync_inventory_purchase_finance
after insert or delete on public.inventory_movements
for each row execute function public.sync_inventory_purchase_finance();


-- ===== 2. ค่าใช้จ่ายประจำเดือน (ค่าเช่า ค่าไฟ ค่าน้ำ ฯลฯ) =====

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  -- วันที่ของเดือนที่ต้องบันทึก (1-28 เพื่อให้มีทุกเดือน)
  day_of_month int not null check (day_of_month between 1 and 28),
  -- เริ่มบันทึกตั้งแต่เดือนนี้ (ไม่ย้อนไปเดือนก่อนหน้า)
  start_month date not null default date_trunc('month', (now() at time zone 'Asia/Bangkok'))::date,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- เดือนที่บันทึกไปแล้ว: กันบันทึกซ้ำ และไม่สร้างใหม่ถ้าแอดมินลบรายการเงินออกของเดือนนั้นทิ้ง
create table if not exists public.recurring_expense_runs (
  recurring_expense_id uuid not null references public.recurring_expenses(id) on delete cascade,
  run_month date not null,
  finance_transaction_id uuid,
  created_at timestamptz not null default now(),
  primary key (recurring_expense_id, run_month)
);

alter table public.recurring_expenses enable row level security;
alter table public.recurring_expense_runs enable row level security;

drop policy if exists recurring_expenses_admin_all on public.recurring_expenses;
create policy recurring_expenses_admin_all
on public.recurring_expenses
for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists recurring_expense_runs_admin_select on public.recurring_expense_runs;
create policy recurring_expense_runs_admin_select
on public.recurring_expense_runs
for select to authenticated
using (public.current_user_is_admin());

-- สร้างรายการเงินออกของทุกเดือนที่ถึงวันครบกำหนดแล้วแต่ยังไม่ได้บันทึก
-- หน้าเว็บการเงินเรียกฟังก์ชันนี้ทุกครั้งที่เปิด จึงไม่ต้องตั้ง cron
create or replace function public.generate_recurring_expenses()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_expense record;
  v_month date;
  v_due date;
  v_transaction_id uuid;
  v_count int := 0;
begin
  if not public.current_user_is_admin() then
    raise exception 'admin only';
  end if;

  for v_expense in
    select * from public.recurring_expenses where is_active
  loop
    for v_month in
      select generate_series(v_expense.start_month, date_trunc('month', v_today)::date, interval '1 month')::date
    loop
      v_due := v_month + (v_expense.day_of_month - 1);
      continue when v_due > v_today;
      continue when exists (
        select 1 from public.recurring_expense_runs
        where recurring_expense_id = v_expense.id and run_month = v_month
      );

      insert into public.finance_transactions
        (transaction_date, transaction_type, category, amount, description, reference_type, reference_id, created_by)
      values
        (
          v_due,
          'expense',
          v_expense.category,
          v_expense.amount,
          v_expense.name || ' ประจำเดือน ' || to_char(v_month, 'MM/YYYY'),
          'recurring_expense',
          -- reference_id ไม่ซ้ำต่อรายการต่อเดือน
          md5(v_expense.id::text || to_char(v_month, 'YYYY-MM'))::uuid,
          v_expense.created_by
        )
      on conflict (reference_type, reference_id)
      where finance_transactions.reference_type is not null
        and finance_transactions.reference_id is not null
      do nothing
      returning id into v_transaction_id;

      insert into public.recurring_expense_runs (recurring_expense_id, run_month, finance_transaction_id)
      values (v_expense.id, v_month, v_transaction_id)
      on conflict do nothing;

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.generate_recurring_expenses() from public;
grant execute on function public.generate_recurring_expenses() to authenticated;
