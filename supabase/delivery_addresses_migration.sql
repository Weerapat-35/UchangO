-- เพิ่มข้อมูลที่อยู่แบบละเอียดสำหรับ checkout
ALTER TABLE public.delivery_addresses
  ADD COLUMN IF NOT EXISTS house_number text,
  ADD COLUMN IF NOT EXISTS moo text,
  ADD COLUMN IF NOT EXISTS soi text,
  ADD COLUMN IF NOT EXISTS road text,
  ADD COLUMN IF NOT EXISTS subdistrict text;

ALTER TABLE public.delivery_addresses
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS place_id text;

-- ตรวจสอบโครงสร้างหลังรัน
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'delivery_addresses'
ORDER BY ordinal_position;
