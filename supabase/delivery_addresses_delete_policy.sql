-- อนุญาตให้ลูกค้าลบ "ที่อยู่จัดส่งของตัวเอง" ได้ (ใช้กับปุ่ม "ลบ" ในหน้าชำระเงิน)
-- รันครั้งเดียวใน Supabase > SQL Editor
-- ตอนนี้ตาราง delivery_addresses มีสิทธิ์ อ่าน / เพิ่ม / แก้ไข ของตัวเองอยู่แล้ว แต่ยังไม่มีสิทธิ์ลบ

drop policy if exists "Users can delete own delivery addresses"
on public.delivery_addresses;

create policy "Users can delete own delivery addresses"
on public.delivery_addresses
for delete
to authenticated
using (customer_id = auth.uid());
