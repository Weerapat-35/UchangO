"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { BrandMark } from "@/components/brand-mark";

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { label: "ภาพรวม", items: [{ href: "/admin", label: "แดชบอร์ด", icon: "grid" }] },
  {
    label: "งานบริการ",
    items: [
      { href: "/admin/bookings", label: "การจองคิว", icon: "calendar" },
      { href: "/admin/repair-jobs", label: "งานซ่อม", icon: "wrench" },
      { href: "/admin/schedule", label: "ตารางคิว", icon: "clock" },
      { href: "/admin/capacity", label: "ความจุคิว", icon: "layers" },
      { href: "/admin/operating-days", label: "วันเปิดร้าน", icon: "store" },
      { href: "/admin/services", label: "บริการ", icon: "tool" },
      { href: "/admin/service-categories", label: "หมวดบริการ", icon: "folder" },
      { href: "/admin/technician-skills", label: "ทักษะช่าง", icon: "badge" },
    ],
  },
  {
    label: "สินค้าและสต็อก",
    items: [
      { href: "/admin/products", label: "สินค้า", icon: "box" },
      { href: "/admin/product-categories", label: "หมวดสินค้า", icon: "folder" },
      { href: "/admin/inventory", label: "คลังสินค้า", icon: "warehouse" },
      { href: "/admin/inventory-review", label: "ตรวจสต็อก", icon: "alert" },
      { href: "/admin/product-orders", label: "ออเดอร์สินค้า", icon: "cart" },
    ],
  },
  {
    label: "จัดการระบบ",
    items: [
      { href: "/admin/customers", label: "ลูกค้า", icon: "users" },
      { href: "/admin/payment-settings", label: "การชำระเงิน", icon: "card" },
      { href: "/admin/reports", label: "รายงาน", icon: "chart" },
      { href: "/admin/notifications", label: "การแจ้งเตือน", icon: "bell" },
    ],
  },
];

function Icon({ name }: { name: string }) {
  const common = { className: "h-[18px] w-[18px]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "calendar": return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M16 2v4M8 2v4M3 9h18"/></svg>;
    case "wrench": return <svg {...common}><path d="M14.7 6.3a4.1 4.1 0 0 0-5.2 5.2L3.6 17.4a2.1 2.1 0 1 0 3 3l5.9-5.9a4.1 4.1 0 0 0 5.2-5.2l-2.6 2.6-2.2-2.2 2.6-2.6Z"/></svg>;
    case "clock": return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "layers": return <svg {...common}><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>;
    case "store": return <svg {...common}><path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/></svg>;
    case "tool": return <svg {...common}><path d="M15 6a5 5 0 0 0-6.7 6.7L3.5 17.5a2.1 2.1 0 0 0 3 3l4.8-4.8A5 5 0 0 0 18 9l-3 3-3-3 3-3Z"/></svg>;
    case "folder": return <svg {...common}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>;
    case "badge": return <svg {...common}><path d="M12 3 9.8 5.2 6.7 5l-.8 3-2.1 2 2.1 2-.1 3.1 3 .8L11 18l1 3 1-3 2.2-2.1 3-.8-.1-3.1 2.1-2-2.1-2-.8-3-3.1.2Z"/><circle cx="12" cy="10" r="2"/></svg>;
    case "box": return <svg {...common}><path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2L12 3Z"/><path d="m4 7.2 8 4.3 8-4.3M12 11.5V21"/></svg>;
    case "warehouse": return <svg {...common}><path d="m3 10 9-6 9 6v10H3V10Z"/><path d="M7 20v-6h10v6M9 10h.01M15 10h.01"/></svg>;
    case "alert": return <svg {...common}><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4M12 17h.01"/></svg>;
    case "cart": return <svg {...common}><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.5L21 8H6"/></svg>;
    case "users": return <svg {...common}><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM16 4a3.5 3.5 0 0 1 0 7M17 14.5h.5a4 4 0 0 1 4 4V20"/></svg>;
    case "card": return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>;
    case "chart": return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>;
    case "bell": return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
    default: return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h8v8H8z"/></svg>;
  }
}

export function AdminSidebar() {
  const pathname = usePathname();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand">
        <BrandMark tone="dark" subtitle="ADMIN MANAGEMENT" />
      </div>

      <Link href="/admin/bookings" className="admin-create-button">
        <span className="admin-create-button__plus">+</span>
        <span>สร้างงานซ่อม</span>
      </Link>

      <nav className="admin-sidebar__nav" aria-label="เมนูผู้ดูแลระบบ">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="admin-nav-group">
            <p className="admin-nav-group__label">{group.label}</p>
            <div className="admin-nav-group__items">
              {group.items.map((item) => {
                const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} className={`admin-nav-item${isActive ? " is-active" : ""}`}>
                    <span className="admin-nav-item__icon"><Icon name={item.icon} /></span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="admin-sidebar__footer">
        <button onClick={handleSignOut} type="button" className="admin-signout">ออกจากระบบ</button>
      </div>
    </aside>
  );
}
