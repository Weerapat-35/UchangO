import Link from "next/link";

type BrandMarkProps = {
  /** "dark" = ใช้บนพื้นเข้ม (asphalt), "light" = ใช้บนพื้นขาว */
  tone?: "dark" | "light";
  size?: "sm" | "md";
  href?: string;
  subtitle?: string;
};

/**
 * โลโก้กลางของอู่ช่างโอ — ไอคอนประแจในวงกลมสีแดง + ชื่อร้าน
 * ใช้ร่วมกันทั้ง AppNav, AdminSidebar, TechnicianSidebar, SiteFooter
 * เพื่อให้แบรนด์ดูเป็นหนึ่งเดียวกันทั้งระบบ แทนที่จะเป็นแค่ข้อความเปล่าๆ
 */
export function BrandMark({ tone = "light", size = "md", href = "/", subtitle }: BrandMarkProps) {
  const textColor = tone === "dark" ? "text-white" : "text-[var(--brand-strong)]";
  const subColor = tone === "dark" ? "text-white/40" : "text-[var(--muted)]";
  const iconBox = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const textSize = size === "sm" ? "text-lg" : "text-xl";

  return (
    <Link href={href} className="group flex shrink-0 items-center gap-2.5">
      <span
        className={`flex ${iconBox} items-center justify-center rounded-lg bg-[var(--brand)] text-white shadow-sm transition group-hover:bg-[var(--brand-strong)]`}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-[55%] w-[55%]" aria-hidden="true">
          <path
            d="M21.5 6.6a4.6 4.6 0 0 1-5.86 4.43L8.4 18.28a1.9 1.9 0 1 1-2.68-2.68l7.25-7.24A4.6 4.6 0 0 1 19 2.5c.5 0 .98.09 1.42.25a.4.4 0 0 1 .13.66l-2.5 2.5a1.4 1.4 0 0 0 1.98 1.98l2.5-2.5a.4.4 0 0 1 .66.13c.16.44.25.92.25 1.08Z"
            fill="currentColor"
          />
          <circle cx="5.6" cy="18.4" r="1.1" fill="currentColor" />
        </svg>
      </span>
      <span className="flex flex-col leading-tight">
        <span className={`font-display ${textSize} font-bold tracking-tight ${textColor}`}>
          อู่ช่างโอ
        </span>
        {subtitle ? (
          <span className={`text-[11px] font-medium uppercase tracking-wide ${subColor}`}>
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
