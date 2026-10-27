import type { ReactNode } from "react";
import { TechnicianSidebar } from "@/components/technician-sidebar";
import { TechnicianTopbar } from "@/components/technician-topbar";

export default function TechnicianLayout({ children }: { children: ReactNode }) {
  return (
    <div className="technician-shell staff-shell">
      <TechnicianSidebar />
      <div className="technician-content staff-content">
        <TechnicianTopbar />
        <div className="technician-content__body">{children}</div>
      </div>
    </div>
  );
}
