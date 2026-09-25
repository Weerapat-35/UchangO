-- เปิด Supabase Realtime สำหรับตะกร้าสินค้า
-- รันใน Supabase SQL Editor 1 ครั้ง

begin;

alter publication supabase_realtime add table public.shopping_carts;
alter publication supabase_realtime add table public.shopping_cart_items;

commit;
