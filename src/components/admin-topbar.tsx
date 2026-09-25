"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StaffNotificationBell } from "@/components/staff-notification-bell";

const TITLES: Record<string, string> = {
  "/admin": "แดชบอร์ด",
  "/admin/bookings": "การจองคิว",
  "/admin/repair-jobs": "งานซ่อม",
  "/admin/schedule": "ตารางคิว",
  "/admin/capacity": "ความจุคิว",
  "/admin/operating-days": "วันเปิดร้าน",
  "/admin/services": "บริการ",
  "/admin/service-categories": "หมวดบริการ",
  "/admin/technician-skills": "ทักษะช่าง",
  "/admin/products": "สินค้า",
  "/admin/product-categories": "หมวดสินค้า",
  "/admin/inventory": "คลังสินค้า",
  "/admin/inventory-review": "ตรวจสต็อก",
  "/admin/product-orders": "ออเดอร์สินค้า",
  "/admin/customers": "ลูกค้า",
  "/admin/payment-settings": "การชำระเงิน",
  "/admin/reports": "รายงาน",
};

export function AdminTopbar() {
  const pathname = usePathname();
  const title = Object.entries(TITLES).find(([path]) => pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`)))?.[1] ?? "จัดการระบบ";

  return (
    <header className="admin-topbar">
      <div>
        <p className="admin-topbar__eyebrow">ระบบจัดการอู่ช่างโอ</p>
        <h1>{title}</h1>
      </div>
      <div className="admin-topbar__actions">
        <StaffNotificationBell role="admin" />
        <Link href="/" className="admin-topbar__site-link">ดูหน้าเว็บไซต์</Link>
        <div className="admin-user-chip">
          <span className="admin-user-chip__avatar">A</span>
          <span><strong>Admin</strong><small>ผู้ดูแลระบบ</small></span>
        </div>
      </div>
    </header>
  );
}
