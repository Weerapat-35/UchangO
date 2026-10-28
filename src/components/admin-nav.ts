// เมนูของฝั่งผู้ดูแลระบบ
import type { StaffNavGroup } from "@/components/staff-nav";

export const ADMIN_NAV_GROUPS: StaffNavGroup[] = [
  { label: "ภาพรวม", items: [{ href: "/admin", label: "แดชบอร์ด", icon: "grid" }] },
  { label: "งานบริการ", items: [
    { href: "/admin/bookings", label: "การจองคิว", icon: "calendar" },
    { href: "/admin/repair-jobs", label: "งานซ่อม", icon: "wrench" },
    { href: "/admin/schedule", label: "ตารางคิว", icon: "clock" },
    { href: "/admin/capacity", label: "ความจุคิว", icon: "layers" },
    { href: "/admin/operating-days", label: "วันเปิดร้าน", icon: "store" },
    { href: "/admin/services", label: "บริการ", icon: "tool" },
    { href: "/admin/service-categories", label: "หมวดบริการ", icon: "folder" },
    { href: "/admin/technician-skills", label: "ทักษะช่าง", icon: "badge" },
  ]},
  { label: "สินค้าและสต็อก", items: [
    { href: "/admin/products", label: "สินค้า", icon: "box" },
    { href: "/admin/product-categories", label: "หมวดสินค้า", icon: "folder" },
    { href: "/admin/inventory", label: "คลังสินค้า", icon: "warehouse" },
    { href: "/admin/inventory-review", label: "ตรวจสต็อก", icon: "alert" },
    { href: "/admin/product-orders", label: "คำสั่งซื้อสินค้า", icon: "cart" },
  ]},
  { label: "การเงินและบุคลากร", items: [
    { href: "/admin/finance", label: "การเงิน", icon: "wallet" },
    { href: "/admin/payroll", label: "เงินเดือนช่าง", icon: "money" },
  ]},
  { label: "จัดการระบบ", items: [
    { href: "/admin/customers", label: "รายชื่อผู้ใช้", icon: "users" },
    { href: "/admin/payment-settings", label: "การชำระเงิน", icon: "card" },
    { href: "/admin/reports", label: "รายงาน", icon: "chart" },
    { href: "/admin/notifications", label: "การแจ้งเตือน", icon: "bell" },
    { href: "/admin/profile", label: "โปรไฟล์ผู้ดูแลระบบ", icon: "users" },
  ]},
];
