// ชนิดข้อมูลและตัวช่วยของเมนูฝั่งพนักงาน (แอดมินและช่าง) ใช้ร่วมกับ StaffSidebar / StaffTopbar
export type StaffNavItem = { href: string; label: string; icon: string };
export type StaffNavGroup = { label: string; items: StaffNavItem[] };

/** เมนูนี้คือหน้าปัจจุบันหรือไม่ (รวมหน้าย่อย) — หน้าแรกของระบบ (rootHref) ต้องตรงทุกตัวอักษร */
export function isNavActive(href: string, pathname: string, rootHref: string) {
  if (href === rootHref) return pathname === rootHref;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** หาเมนูและกลุ่มของหน้าปัจจุบัน สำหรับแสดงชื่อหน้าในแถบบน */
export function findNav(groups: StaffNavGroup[], pathname: string, rootHref: string) {
  for (const group of groups) {
    const item = group.items.find((entry) => isNavActive(entry.href, pathname, rootHref));
    if (item) return { group, item };
  }
  return null;
}
