"use client";

import { ADMIN_NAV_GROUPS } from "@/components/admin-nav";
import { StaffSidebar } from "@/components/staff-shell";

export function AdminSidebar() {
  return <StaffSidebar groups={ADMIN_NAV_GROUPS} homeHref="/admin" subtitle="ระบบจัดการอู่" ariaLabel="เมนูผู้ดูแลระบบ" searchable />;
}
