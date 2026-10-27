"use client";

import { ADMIN_NAV_GROUPS } from "@/components/admin-nav";
import { StaffTopbar } from "@/components/staff-shell";

export function AdminTopbar() {
  return (
    <StaffTopbar
      groups={ADMIN_NAV_GROUPS}
      homeHref="/admin"
      fallbackTitle="จัดการระบบ"
      fallbackSection="ผู้ดูแลระบบ"
      profileHref="/admin/profile"
      roleLabel="ผู้ดูแลระบบ"
      notificationRole="admin"
    />
  );
}
