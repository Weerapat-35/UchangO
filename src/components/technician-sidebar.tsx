"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

const NAV_ITEMS = [
  { href: "/technician/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/technician/work-orders", label: "งานซ่อมของฉัน", icon: "🔧" },
  { href: "/technician/profile", label: "โปรไฟล์ช่าง", icon: "👤" },
  { href: "/technician/notifications", label: "การแจ้งเตือน", icon: "🔔" },
];

export function TechnicianSidebar() {
  const pathname = usePathname();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <aside className="technician-sidebar">
      <div className="technician-sidebar__brand">
        <Link href="/technician/work-orders" className="technician-sidebar__logo">
          <span className="technician-sidebar__logo-mark">O</span>
          <span>
            <strong>อู่ช่างโอ</strong>
            <small>GARAGE SERVICE</small>
          </span>
        </Link>
      </div>

      <div className="technician-sidebar__section-label">เมนูช่าง</div>
      <nav className="technician-sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`technician-nav-item${isActive ? " is-active" : ""}`}
            >
              <span className="technician-nav-item__icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="technician-sidebar__footer">
        <button onClick={handleSignOut} type="button" className="technician-signout">
          ↪ ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
