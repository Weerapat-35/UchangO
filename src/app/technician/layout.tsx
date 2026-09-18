import type { ReactNode } from "react";
import { TechnicianSidebar } from "@/components/technician-sidebar";

export default function TechnicianLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <TechnicianSidebar />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
