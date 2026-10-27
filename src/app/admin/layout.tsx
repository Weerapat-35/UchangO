import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell staff-shell">
      <AdminSidebar />
      <div className="admin-content staff-content">
        <AdminTopbar />
        <div className="admin-content__body">{children}</div>
      </div>
    </div>
  );
}
