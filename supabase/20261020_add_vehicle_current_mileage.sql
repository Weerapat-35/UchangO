-- เพิ่มเลขไมล์ล่าสุดให้รถแต่ละคัน โดยไม่กระทบข้อมูลรถเดิม
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS current_mileage integer NULL
CHECK (current_mileage IS NULL OR current_mileage >= 0);
