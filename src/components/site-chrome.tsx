"use client";

import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";

export function SiteChrome() {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isTechnician = pathname === "/technician" || pathname.startsWith("/technician/");
  const isInvoice = pathname === "/invoice" || pathname.startsWith("/invoice/");

  if (isAdmin || isTechnician || isInvoice) return null;

  return <AppNav />;
}
