import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-[var(--foreground)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-5 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} อู่ช่างโอ ระบบจัดการอู่ซ่อมรถ</p>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/" className="hover:text-white">
            ติดต่อเรา
          </Link>
          <Link href="/" className="hover:text-white">
            นโยบายความเป็นส่วนตัว
          </Link>
          <Link href="/" className="hover:text-white">
            เงื่อนไขการใช้บริการ
          </Link>
          <Link href="/" className="hover:text-white">
            ความช่วยเหลือ
          </Link>
        </div>
      </div>
    </footer>
  );
}
