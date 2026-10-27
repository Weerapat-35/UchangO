"use client";

import { StaffTopbar } from "@/components/staff-shell";
import { TECHNICIAN_NAV_GROUPS } from "@/components/technician-nav";

export function TechnicianTopbar() {
  return (
    <StaffTopbar
      groups={TECHNICIAN_NAV_GROUPS}
      homeHref="/technician/dashboard"
      fallbackTitle="ระบบสำหรับช่าง"
      fallbackSection="ช่าง"
      subpageTitles={[["/technician/work-orders/", "รายละเอียดใบงานซ่อม"]]}
      profileHref="/technician/profile"
      roleLabel="ช่าง"
      notificationRole="technician"
    />
  );
}
