"use client";

import { usePathname } from "next/navigation";
import { StaffNotificationBell } from "@/components/staff-notification-bell";

const TITLES: Record<string, string> = {
  "/technician/dashboard": "Dashboard ช่าง",
  "/technician/work-orders": "งานซ่อมของฉัน",
  "/technician/profile": "โปรไฟล์ช่าง",
};

export function TechnicianTopbar() {
  const pathname = usePathname();
  const title = pathname.startsWith("/technician/work-orders/")
    ? "รายละเอียดงานซ่อม"
    : TITLES[pathname] ?? "ระบบสำหรับช่าง";

  return (
    <header className="technician-topbar">
      <div>
        <p className="technician-topbar__eyebrow">ระบบช่าง • อู่ช่างโอ</p>
        <h1>{title}</h1>
      </div>
      <div className="technician-topbar__actions">
        <StaffNotificationBell role="technician" />
        <div className="technician-topbar__status">
        <span className="technician-topbar__dot" />
        <span>ช่าง</span>
        </div>
      </div>
    </header>
  );
}
