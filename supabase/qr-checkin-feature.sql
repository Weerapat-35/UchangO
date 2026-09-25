-- qr-checkin-feature.sql
-- รันใน Supabase SQL Editor เพื่อเปิดใช้ฟีเจอร์ QR Code เช็คอิน
-- (ไฟล์นี้หายไปจากโปรเจกต์คุณ ทั้งที่โค้ด checkin-panel.tsx เขียนไว้แล้ว
--  เลยทำให้ TypeScript หา checked_in_at ไม่เจอ)

alter table bookings
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references profiles(id);

comment on column bookings.checked_in_at is 'เวลาที่ลูกค้าเช็คอินถึงร้าน (ยืนยันผ่าน QR Code)';
comment on column bookings.checked_in_by is 'พนักงาน/แอดมินที่กดยืนยันเช็คอินให้ลูกค้า';
