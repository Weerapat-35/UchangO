"use client";

import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";

export function SiteChrome() {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isTechnician = pathname === "/technician" || pathname.startsWith("/technician/");

  if (isAdmin || isTechnician) return null;

  return <AppNav />;
}
