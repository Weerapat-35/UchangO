"use client";

import { StaffSidebar } from "@/components/staff-shell";
import { TECHNICIAN_NAV_GROUPS } from "@/components/technician-nav";

export function TechnicianSidebar() {
  return <StaffSidebar groups={TECHNICIAN_NAV_GROUPS} homeHref="/technician/dashboard" subtitle="ระบบสำหรับช่าง" ariaLabel="เมนูช่าง" />;
}
