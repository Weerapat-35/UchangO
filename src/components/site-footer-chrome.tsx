"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";

export function SiteFooterChrome() {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isTechnician = pathname === "/technician" || pathname.startsWith("/technician/");
  const isInvoice = pathname === "/invoice" || pathname.startsWith("/invoice/");

  if (isAdmin || isTechnician || isInvoice) return null;

  return <SiteFooter />;
}
