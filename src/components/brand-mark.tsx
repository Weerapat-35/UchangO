import Link from "next/link";

type BrandMarkProps = {
  /** "dark" = ใช้บนพื้นเข้ม, "light" = ใช้บนพื้นขาว */
  tone?: "dark" | "light";
  size?: "sm" | "md";
  href?: string;
  subtitle?: string;
};

/** โลโก้หลักของอู่ช่างโอ ใช้รูปโลโก้เดียวกันทั้งระบบ */
export function BrandMark({ tone = "light", size = "md", href = "/", subtitle }: BrandMarkProps) {
  const logoClass = size === "sm" ? "brand-mark__image brand-mark__image--sm" : "brand-mark__image";
  const frameClass = tone === "dark" ? "brand-mark__frame brand-mark__frame--dark" : "brand-mark__frame";

  return (
    <Link href={href} className="brand-mark" aria-label="อู่ช่างโอ หน้าหลัก">
      <span className={frameClass}>
        <img src="/brand/ouchang-o-logo.png" alt="อู่ช่างโอ" className={logoClass} />
      </span>
      {subtitle ? <span className="brand-mark__subtitle">{subtitle}</span> : null}
    </Link>
  );
}
