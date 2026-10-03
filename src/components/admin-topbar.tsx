"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StaffNotificationBell } from "@/components/staff-notification-bell";

const TITLES: Record<string,string> = {
  "/admin":"แดชบอร์ด", "/admin/bookings":"การจองคิว", "/admin/repair-jobs":"งานซ่อม", "/admin/schedule":"ตารางคิว", "/admin/capacity":"ความจุคิว", "/admin/operating-days":"วันเปิดร้าน", "/admin/services":"บริการ", "/admin/service-categories":"หมวดบริการ", "/admin/technician-skills":"ทักษะช่าง", "/admin/products":"สินค้า", "/admin/product-categories":"หมวดสินค้า", "/admin/inventory":"คลังสินค้า", "/admin/inventory-review":"ตรวจสต็อก", "/admin/product-orders":"ออเดอร์สินค้า", "/admin/customers":"ลูกค้า", "/admin/payment-settings":"การชำระเงิน", "/admin/reports":"รายงาน", "/admin/finance":"การเงิน", "/admin/payroll":"เงินเดือนช่าง", "/admin/notifications":"การแจ้งเตือน"
};

const TITLE_ICONS: Record<string, string> = {
  "/admin": "grid", "/admin/bookings": "calendar", "/admin/repair-jobs": "wrench",
  "/admin/schedule": "clock", "/admin/capacity": "layers", "/admin/operating-days": "store",
  "/admin/services": "tool", "/admin/service-categories": "folder", "/admin/technician-skills": "badge",
  "/admin/products": "box", "/admin/product-categories": "folder", "/admin/inventory": "warehouse",
  "/admin/inventory-review": "alert", "/admin/product-orders": "cart", "/admin/customers": "users",
  "/admin/payment-settings": "card", "/admin/reports": "chart", "/admin/finance": "wallet",
  "/admin/payroll": "money", "/admin/notifications": "bell"
};

function TitleIcon({name}:{name:string}){
  const common={viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
  switch(name){
    case "calendar": return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M16 2v4M8 2v4M3 9h18"/></svg>;
    case "wrench": return <svg {...common}><path d="M14.7 6.3a4.1 4.1 0 0 0-5.2 5.2L3.6 17.4a2.1 2.1 0 1 0 3 3l5.9-5.9a4.1 4.1 0 0 0 5.2-5.2l-2.6 2.6-2.2-2.2 2.6-2.6Z"/></svg>;
    case "clock": return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "wallet": return <svg {...common}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Z"/><path d="M16 12h5M17 12h.01"/></svg>;
    case "money": return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M7 8h.01M17 16h.01"/></svg>;
    case "chart": return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>;
    case "users": return <svg {...common}><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM16 4a3.5 3.5 0 0 1 0 7M17 14.5h.5a4 4 0 0 1 4 4V20"/></svg>;
    case "bell": return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
    case "box": return <svg {...common}><path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2L12 3Z"/><path d="m4 7.2 8 4.3 8-4.3M12 11.5V21"/></svg>;
    case "cart": return <svg {...common}><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.5L21 8H6"/></svg>;
    default: return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h8v8H8z"/></svg>;
  }
}

function SearchIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>}
function MenuIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h10"/></svg>}
function ExpandIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/></svg>}
function BookmarkIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V21l-6-3-6 3V4.5Z"/></svg>}

export function AdminTopbar(){
  const pathname=usePathname();
  const titleEntry=Object.entries(TITLES).find(([path])=>pathname===path || (path!=="/admin"&&pathname.startsWith(`${path}/`)));
  const title=titleEntry?.[1] ?? "จัดการระบบ";
  const titleKey=titleEntry?.[0] ?? "/admin";
  const titleIcon=TITLE_ICONS[titleKey] ?? "grid";
  return <header className="admin-topbar">
    <div className="admin-topbar__left">
      <button className="admin-icon-button" type="button" aria-label="เมนู"><MenuIcon/></button>
      <div className="admin-page-heading">
        <div className="admin-page-heading__icon"><TitleIcon name={titleIcon}/></div>
        <div className="admin-page-heading__copy">
          <div className="admin-page-heading__meta"><span>อู่ช่างโอ</span><i/> <span>ผู้ดูแลระบบ</span></div>
          <h1>{title}</h1>
          <div className="admin-page-heading__line"><b/><span/></div>
        </div>
      </div>
    </div>
    <div className="admin-topbar__actions">
      <button className="admin-icon-button admin-search-button" type="button" aria-label="ค้นหา"><SearchIcon/></button>
      <button className="admin-icon-button admin-expand-button" type="button" aria-label="เต็มหน้าจอ"><ExpandIcon/></button>
      <button className="admin-icon-button admin-bookmark-button" type="button" aria-label="บันทึก"><BookmarkIcon/></button>
      <div className="admin-topbar__notification"><StaffNotificationBell role="admin" /></div>
      <Link href="/" className="admin-topbar__site-link">หน้าเว็บไซต์</Link>
      <div className="admin-user-chip"><span className="admin-user-chip__avatar">A</span><span><strong>Admin</strong><small>ผู้ดูแลระบบ</small></span></div>
    </div>
  </header>;
}
