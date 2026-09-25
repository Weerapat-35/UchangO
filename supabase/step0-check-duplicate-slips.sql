-- รันคำสั่งนี้ก่อน (แยกต่างหาก) เพื่อเช็คว่ามีสลิปเดิมที่ถูกยืนยันซ้ำกันหรือไม่
-- ถ้า "ไม่มีแถวไหนแสดงผลเลย" (0 rows) แปลว่าปลอดภัย ไปรัน sync-part2 ได้เลย
-- ถ้ามีแถวแสดงผล ให้แก้ไข/ลบรายการซ้ำที่ผิดพลาดออกก่อน แล้วค่อยรัน part2

select provider_reference, array_agg(id) as payment_ids
from public.product_payments
where provider_reference is not null
group by provider_reference
having count(*) > 1;
