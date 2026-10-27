"use client";

// โครงหน้าของฝั่งพนักงาน (แอดมินและช่าง): เมนูซ้าย + แถบบน
// จอกว้างเมนูซ้ายติดอยู่ตลอด จอเล็กเมนูเป็นลิ้นชักที่เปิดจากปุ่ม ☰ บนแถบบน
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { StaffNotificationBell } from "@/components/staff-notification-bell";
import { findNav, isNavActive, type StaffNavGroup } from "@/components/staff-nav";
import { createClient } from "@/lib/supabase/browser";

const TOGGLE_EVENT = "staff:toggle-sidebar";
const CLOSE_EVENT = "staff:close-sidebar";

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
    case "wallet": return <svg {...common}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Z"/><path d="M16 12h5M17 12h.01"/></svg>;
    case "money": return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M7 8h.01M17 16h.01"/></svg>;
    case "bell": return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
    default: return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h8v8H8z"/></svg>;
  }
}

type StaffSidebarProps = {
  groups: StaffNavGroup[];
  /** หน้าแรกของระบบ เช่น /admin หรือ /technician/dashboard */
  homeHref: string;
  /** ข้อความใต้ชื่อร้าน เช่น "ระบบจัดการอู่" */
  subtitle: string;
  /** ป้ายอธิบายเมนูสำหรับโปรแกรมอ่านหน้าจอ */
  ariaLabel: string;
  /** แสดงช่องค้นหาเมนู (เหมาะกับเมนูยาว) */
  searchable?: boolean;
};

export function StaffSidebar({ groups: allGroups, homeHref, subtitle, ariaLabel, searchable = false }: StaffSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const toggle = () => setOpen((value) => !value);
    const close = () => setOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener(TOGGLE_EVENT, toggle);
    window.addEventListener(CLOSE_EVENT, close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener(TOGGLE_EVENT, toggle);
      window.removeEventListener(CLOSE_EVENT, close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  // เลื่อนเมนูให้เห็นหน้าที่เปิดอยู่เสมอ (เมนูยาวกว่าความสูงจอ)
  useEffect(() => {
    document.querySelector(".staff-nav-item.is-active")?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const keyword = query.trim().toLowerCase();
  const groups = keyword
    ? allGroups
      .map((group) => ({ ...group, items: group.items.filter((item) => item.label.toLowerCase().includes(keyword)) }))
      .filter((group) => group.items.length > 0)
    : allGroups;

  return (
    <>
      <button className={`staff-sidebar__backdrop${open ? " is-open" : ""}`} type="button" aria-label="ปิดเมนู" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
      <aside id="staff-sidebar" className={`staff-sidebar${open ? " is-open" : ""}`} aria-label={ariaLabel}>
        <div className="staff-sidebar__head">
          <Link href={homeHref} className="staff-sidebar__title" onClick={() => setOpen(false)}>
            <Image src="/brand/ouchang-o-logo.png" alt="อู่ช่างโอ" width={800} height={374} className="staff-sidebar__logo" priority />
            <span>{subtitle}</span>
          </Link>
          <button type="button" className="staff-sidebar__close" onClick={() => setOpen(false)} aria-label="ปิดเมนู">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {searchable ? (
          <label className="staff-sidebar__search">
            <span className="sr-only">ค้นหาเมนู</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเมนู" />
          </label>
        ) : null}

        <nav className="staff-sidebar__nav">
          {groups.map((group) => (
            <div key={group.label} className="staff-nav-group">
              <p className="staff-nav-group__label">{group.label}</p>
              <div className="staff-nav-group__items">
                {group.items.map((item) => {
                  const isActive = isNavActive(item.href, pathname, homeHref);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => { setOpen(false); setQuery(""); }}
                      className={`staff-nav-item${isActive ? " is-active" : ""}`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="staff-nav-item__icon" aria-hidden="true"><Icon name={item.icon} /></span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {groups.length === 0 ? <p className="staff-sidebar__empty">ไม่พบเมนู “{query.trim()}”</p> : null}
        </nav>

        <div className="staff-sidebar__footer">
          <Link href="/" className="staff-sidebar__link">
            <span className="staff-nav-item__icon" aria-hidden="true"><Icon name="store" /></span>
            <span>ดูหน้าเว็บไซต์</span>
          </Link>
          <button onClick={handleSignOut} type="button" className="staff-signout">
            <span className="staff-nav-item__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" /></svg>
            </span>
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>
    </>
  );
}

type StaffTopbarProps = {
  groups: StaffNavGroup[];
  homeHref: string;
  /** ชื่อหน้าเมื่อหาในเมนูไม่เจอ */
  fallbackTitle: string;
  fallbackSection: string;
  /** หน้าย่อยที่ไม่มีในเมนู เช่น รายละเอียดใบงาน: [ขึ้นต้นด้วย, ชื่อหน้า] */
  subpageTitles?: [string, string][];
  profileHref: string;
  roleLabel: string;
  notificationRole: "admin" | "technician";
};

export function StaffTopbar({ groups, homeHref, fallbackTitle, fallbackSection, subpageTitles = [], profileHref, roleLabel, notificationRole }: StaffTopbarProps) {
  const pathname = usePathname();
  const current = findNav(groups, pathname, homeHref);
  const subpage = subpageTitles.find(([prefix]) => pathname.startsWith(prefix));
  const title = subpage?.[1] ?? current?.item.label ?? fallbackTitle;
  const section = current?.group.label ?? fallbackSection;

  return (
    <header className="staff-topbar">
      <div className="staff-topbar__left">
        <button
          className="staff-topbar__menu"
          type="button"
          aria-label="เปิดเมนู"
          aria-controls="staff-sidebar"
          onClick={() => window.dispatchEvent(new Event(TOGGLE_EVENT))}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div className="staff-topbar__heading">
          <p className="staff-topbar__section">{section}</p>
          <p className="staff-topbar__title">{title}</p>
        </div>
      </div>
      <div className="staff-topbar__actions">
        <div className="staff-topbar__notification"><StaffNotificationBell role={notificationRole} /></div>
        <Link href={profileHref} className="staff-user-chip" aria-label={`โปรไฟล์${roleLabel}`}>
          <span className="staff-user-chip__avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
          </span>
          <span className="staff-user-chip__label">{roleLabel}</span>
        </Link>
      </div>
    </header>
  );
}
