// เมนูของฝั่งช่าง
import type { StaffNavGroup } from "@/components/staff-nav";

export const TECHNICIAN_NAV_GROUPS: StaffNavGroup[] = [
  { label: "งานของฉัน", items: [
    { href: "/technician/dashboard", label: "แดชบอร์ด", icon: "grid" },
    { href: "/technician/work-orders", label: "งานซ่อมของฉัน", icon: "wrench" },
  ]},
  { label: "บัญชี", items: [
    { href: "/technician/notifications", label: "การแจ้งเตือน", icon: "bell" },
    { href: "/technician/profile", label: "โปรไฟล์ช่าง", icon: "users" },
  ]},
];
