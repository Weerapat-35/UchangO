-- =========================================================================
-- BCare: Sync to reference schema — PART 2 (ความสมบูรณ์ของการจ่ายเงิน)
-- =========================================================================
-- ก่อนรันไฟล์นี้ ต้องรัน step0-check-duplicate-slips.sql ก่อน แล้วต้องได้
-- ผลลัพธ์ 0 rows เท่านั้น ไม่งั้นคำสั่ง CREATE UNIQUE INDEX ด้านล่างจะ error
-- (เพราะพบ provider_reference ที่ถูกใช้ยืนยันสำเร็จซ้ำกันมากกว่า 1 ออเดอร์)
-- =========================================================================


-- -------------------------------------------------------------------------
-- 1) product-payment-provider-reference-unique.sql
--    กันเลขอ้างอิงสลิป (transRef จาก SlipOK) เดียวกันถูกใช้ยืนยันสำเร็จ
--    ซ้ำมากกว่า 1 รายการใน product_payments
-- -------------------------------------------------------------------------
drop index if exists public.product_payments_provider_reference_idx;

create unique index if not exists product_payments_provider_reference_key
on public.product_payments(provider_reference)
where provider_reference is not null;


-- -------------------------------------------------------------------------
-- 2) product-order-payment-ledger.sql
--    ตาราง ledger แบบ append-only เก็บเฉพาะรายการที่ยืนยันได้จริงว่าได้เงินแล้ว
--    ทำให้ payment_status ของออเดอร์คำนวณจากของจริงเสมอ ไม่ใช่ตั้งตรงๆ จาก
--    โค้ดฝั่งไหนก็ได้ที่บังเอิญรันผ่าน (SlipOK route หรือแอดมินกดอนุมัติมือ)
-- -------------------------------------------------------------------------
create table if not exists public.product_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  product_payment_id uuid not null references public.product_payments(id) on delete cascade,
  product_order_id uuid not null references public.product_orders(id) on delete cascade,
  provider_reference text not null,
  verified_amount numeric(10, 2) not null,
  verified_by_type text not null,
  verified_by_user_id uuid references public.profiles(id) on delete set null,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_payment_transactions_verified_amount_check'
      and conrelid = 'public.product_payment_transactions'::regclass
  ) then
    alter table public.product_payment_transactions
    add constraint product_payment_transactions_verified_amount_check
      check (verified_amount > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_payment_transactions_verified_by_type_check'
      and conrelid = 'public.product_payment_transactions'::regclass
  ) then
    alter table public.product_payment_transactions
    add constraint product_payment_transactions_verified_by_type_check
      check (verified_by_type in ('system_slipok', 'admin_manual'));
  end if;

  -- เพิ่มค่า 'partially_paid' ต่อจากค่าเดิมของ product_orders.payment_status
  -- (ค่าเดิม 'unpaid','pending','paid','refunded','cancelled' ยังใช้ได้ปกติ)
  if exists (
    select 1
    from pg_constraint
    where conname = 'product_orders_payment_status_check'
      and conrelid = 'public.product_orders'::regclass
  ) then
    alter table public.product_orders
    drop constraint product_orders_payment_status_check;
  end if;

  alter table public.product_orders
  add constraint product_orders_payment_status_check
    check (
      payment_status in (
        'unpaid',
        'pending',
        'partially_paid',
        'paid',
        'refunded',
        'cancelled'
      )
    );
end $$;

-- provider_reference เดียวกัน ยืนยันสำเร็จซ้ำไม่ได้ทั้งระบบ (เข้มกว่า index
-- ในข้อ 1 ที่ยังเก็บไว้เฉยๆ ไม่ลบ เพราะไม่ขัดแย้งกัน)
create unique index if not exists product_payment_transactions_provider_reference_key
on public.product_payment_transactions(provider_reference);

create index if not exists product_payment_transactions_order_idx
on public.product_payment_transactions(product_order_id);

-- เขียนตารางนี้ได้เฉพาะฝั่ง server (service role: verify-slipok route กับ
-- ปุ่มอนุมัติมือของแอดมิน) เท่านั้น ไม่มี policy ให้ authenticated
-- insert/update/delete เอง อ่านได้แค่แอดมินกับเจ้าของออเดอร์
alter table public.product_payment_transactions enable row level security;

drop policy if exists "Admins can read all payment transactions"
on public.product_payment_transactions;
create policy "Admins can read all payment transactions"
on public.product_payment_transactions
for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "Customers can read own order payment transactions"
on public.product_payment_transactions;
create policy "Customers can read own order payment transactions"
on public.product_payment_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.product_orders
    where product_orders.id = product_payment_transactions.product_order_id
      and product_orders.customer_id = auth.uid()
  )
);

-- =========================================================================
-- จบ PART 2 — Supabase ของคุณตอนนี้เท่ากับระบบอ้างอิงครบ 11/11 ไฟล์แล้ว
-- (2 ไฟล์เรื่องจ่ายค่าซ่อมได้ส่งแยกไปก่อนหน้านี้ใน booking-payment-feature.sql)
-- อย่าลืม regenerate database.types.ts หลังรันเสร็จ:
--   npx supabase gen types typescript --project-id YOUR_PROJECT_REF \
--     > src/lib/supabase/database.types.ts
-- =========================================================================
