"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "ภาพรวม",
    items: [{ href: "/admin", label: "หน้าแรก" }],
  },
  {
    label: "งานบริการ",
    items: [
      { href: "/admin/bookings", label: "การจอง" },
      { href: "/admin/repair-jobs", label: "งานซ่อม" },
      { href: "/admin/schedule", label: "ตารางคิว" },
      { href: "/admin/capacity", label: "ความจุคิว" },
      { href: "/admin/operating-days", label: "วันเปิดร้าน" },
      { href: "/admin/services", label: "บริการ" },
      { href: "/admin/service-categories", label: "หมวดบริการ" },
      { href: "/admin/technician-skills", label: "ทักษะช่าง" },
    ],
  },
  {
    label: "สินค้า",
    items: [
      { href: "/admin/products", label: "สินค้า" },
      { href: "/admin/product-categories", label: "หมวดสินค้า" },
      { href: "/admin/inventory", label: "คลังสินค้า" },
      { href: "/admin/inventory-review", label: "ตรวจสต็อก" },
      { href: "/admin/product-orders", label: "ออเดอร์สินค้า" },
    ],
  },
  {
    label: "อื่นๆ",
    items: [
      { href: "/admin/customers", label: "ลูกค้า" },
      { href: "/admin/payment-settings", label: "การชำระเงิน" },
      { href: "/admin/reports", label: "รายงาน" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-[var(--foreground)] px-4 py-6">
      <Link href="/" className="px-2 font-display text-2xl font-bold text-white">
        อู่ช่างโอ
      </Link>

      <Link
        href="/admin/bookings"
        className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-3 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]"
      >
        + สร้างใบสั่งซ่อม
      </Link>

      <nav className="mt-6 flex-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-white/30">
              {group.label}
            </p>
            <div className="mt-2 flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      isActive
                        ? "rounded-lg bg-[var(--brand)] px-3 py-2.5 text-sm font-semibold text-white"
                        : "rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <button
        onClick={handleSignOut}
        type="button"
        className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-white/50 transition hover:bg-white/5 hover:text-white"
      >
        ออกจากระบบ
      </button>
    </aside>
  );
}
