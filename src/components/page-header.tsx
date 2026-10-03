import Link from "next/link";
import type { ReactNode } from "react";
import "./page-header.css";

export type PageHeaderCrumb = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  /** หัวข้อหน้า */
  title: string;
  /** คำอธิบายใต้หัวข้อ */
  description?: string;
  /** เส้นทางต่อจาก "หน้าหลัก" รายการสุดท้ายคือหน้าปัจจุบัน */
  crumbs: PageHeaderCrumb[];
  /** ป้ายเล็กๆ ต่อท้ายหัวข้อ เช่น เลขที่ออเดอร์ */
  titleExtra?: ReactNode;
  /** ปุ่ม/ตัวเลขสรุป แสดงใต้ breadcrumb ฝั่งขวา */
  actions?: ReactNode;
  className?: string;
};

function HomeIcon() {
  return (
    <svg aria-hidden="true" className="ph-icon" viewBox="0 0 24 24">
      <path d="M4 11 12 4l8 7M6 10v10h12V10" />
    </svg>
  );
}

/**
 * ส่วนหัวมาตรฐานของทุกหน้าลูกค้า:
 * ซ้าย = หัวข้อ + คำอธิบาย, ขวา = breadcrumb (+ ปุ่ม/สรุป ถ้ามี)
 */
export function PageHeader({
  actions,
  className,
  crumbs,
  description,
  title,
  titleExtra,
}: PageHeaderProps) {
  return (
    <header className={`ph${className ? ` ${className}` : ""}`}>
      <div className="ph__text">
        <div className="ph__title-row">
          <h1>{title}</h1>
          {titleExtra}
        </div>
        {description ? <p>{description}</p> : null}
      </div>

      <div className="ph__side">
        <nav aria-label="breadcrumb" className="ph__crumb">
          <Link aria-label="หน้าหลัก" className="ph__home" href="/">
            <HomeIcon />
          </Link>
          <Link href="/">หน้าหลัก</Link>
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;

            return (
              <span className="ph__crumb-item" key={`${crumb.label}-${index}`}>
                <span aria-hidden="true">›</span>
                {isLast || !crumb.href ? (
                  <strong aria-current={isLast ? "page" : undefined}>
                    {crumb.label}
                  </strong>
                ) : (
                  <Link href={crumb.href}>{crumb.label}</Link>
                )}
              </span>
            );
          })}
        </nav>
        {actions ? <div className="ph__actions">{actions}</div> : null}
      </div>
    </header>
  );
}
