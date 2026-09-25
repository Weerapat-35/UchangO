import type { ReactNode } from "react";
import { TechnicianSidebar } from "@/components/technician-sidebar";
import { TechnicianTopbar } from "@/components/technician-topbar";

export default function TechnicianLayout({ children }: { children: ReactNode }) {
  return (
    <div className="technician-shell">
      <TechnicianSidebar />
      <div className="technician-content">
        <TechnicianTopbar />
        <div className="technician-content__body">{children}</div>
      </div>
    </div>
  );
}
