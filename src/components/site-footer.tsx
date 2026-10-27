import Link from "next/link";

const MENU_LINKS = [
  { href: "/services", label: "บริการ" },
  { href: "/products", label: "สินค้าและอะไหล่" },
  { href: "/my-bookings", label: "การจองของฉัน" },
  { href: "/my-vehicles", label: "รถของฉัน" },
];

// TODO: ยังไม่มีหน้าจริงของลิงก์กลุ่มนี้ ตอนนี้จึงพาไปหน้าแรกไว้ก่อน
const HELP_LINKS = [
  { href: "/", label: "ติดต่อเรา" },
  { href: "/", label: "นโยบายความเป็นส่วนตัว" },
  { href: "/", label: "เงื่อนไขการใช้บริการ" },
  { href: "/", label: "ความช่วยเหลือ" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <strong>อู่ช่างโอ</strong>
          <p>ศูนย์บริการรถยนต์ครบวงจร จองคิวซ่อมรถออนไลน์ และติดตามงานซ่อมได้ทุกขั้นตอน</p>
          <Link href="/services" className="site-footer__cta">เลือกบริการและจองคิว</Link>
        </div>
        <nav className="site-footer__col" aria-label="เมนูลัด">
          <p>เมนู</p>
          {MENU_LINKS.map((link) => <Link key={link.label} href={link.href}>{link.label}</Link>)}
        </nav>
        <nav className="site-footer__col" aria-label="ช่วยเหลือ">
          <p>ช่วยเหลือ</p>
          {HELP_LINKS.map((link) => <Link key={link.label} href={link.href}>{link.label}</Link>)}
        </nav>
      </div>
      <div className="site-footer__bottom">
        <p>© {new Date().getFullYear()} อู่ช่างโอ ระบบจัดการอู่ซ่อมรถ</p>
      </div>
    </footer>
  );
}
