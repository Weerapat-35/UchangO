-- เก็บ "เหตุผลที่ลูกค้ายกเลิกคำสั่งซื้อ"
-- รันครั้งเดียวใน Supabase > SQL Editor
-- ต้องรัน sync-part1-safe.sql (ที่มีฟังก์ชัน cancel_own_product_order_with_inventory_return) ไว้ก่อนแล้ว

alter table public.product_orders
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz;

-- ยกเลิกคำสั่งซื้อของตัวเองพร้อมเหตุผล
-- ใช้กติกาและการคืนสต็อกเดิมทั้งหมด (ยกเลิกได้เฉพาะคำสั่งซื้อที่ยัง pending และยังไม่ชำระเงิน)
create or replace function public.cancel_own_product_order_with_reason(
  target_order_id uuid,
  reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  returned_count integer;
begin
  returned_count := public.cancel_own_product_order_with_inventory_return(target_order_id);

  update public.product_orders
  set
    cancellation_reason = nullif(left(btrim(coalesce(reason, '')), 300), ''),
    cancelled_at = now()
  where id = target_order_id
    and customer_id = auth.uid();

  return returned_count;
end;
$$;

revoke all on function public.cancel_own_product_order_with_reason(uuid, text) from public;
grant execute on function public.cancel_own_product_order_with_reason(uuid, text) to authenticated;
