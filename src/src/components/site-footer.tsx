import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--line)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} อู่ช่างโอ ระบบจัดการอู่ซ่อมรถ</p>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/" className="transition hover:text-[var(--foreground)]">
            ติดต่อเรา
          </Link>
          <Link href="/" className="transition hover:text-[var(--foreground)]">
            นโยบายความเป็นส่วนตัว
          </Link>
          <Link href="/" className="transition hover:text-[var(--foreground)]">
            เงื่อนไขการใช้บริการ
          </Link>
          <Link href="/" className="transition hover:text-[var(--foreground)]">
            ความช่วยเหลือ
          </Link>
        </div>
      </div>
    </footer>
  );
}
