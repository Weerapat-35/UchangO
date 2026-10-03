อู่ช่างโอ — Admin Redesign v1

ปรับเฉพาะ UI ฝั่ง /admin โดยไม่เปลี่ยน Supabase/Database/logic หลัก

ไฟล์ที่ต้องนำไปทับในโปรเจกต์ปัจจุบัน:
1) src/components/admin-sidebar.tsx
2) src/components/admin-topbar.tsx
3) src/features/admin/components/admin-access-panel.tsx
4) src/app/globals.css

หลังทับไฟล์ให้รัน:
npm run typecheck
npm run build
npm run dev

แนวดีไซน์: dark sidebar + white topbar + light workspace + spacious cards + red brand accent
อิงโครงสร้างจากภาพอ้างอิง แต่ปรับข้อมูลและข้อความให้เป็นระบบอู่ช่างโอจริง
