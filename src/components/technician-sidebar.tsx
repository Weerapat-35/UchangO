"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

const NAV_ITEMS = [
  { href: "/technician/work-orders", label: "งานซ่อมของฉัน" },
  { href: "/technician/profile", label: "โปรไฟล์ช่าง" },
];

export function TechnicianSidebar() {
  const pathname = usePathname();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-[var(--foreground)] px-4 py-6">
      <Link href="/" className="px-2 font-display text-2xl font-bold text-white">
        อู่ช่างโอ
      </Link>
      <p className="mt-1 px-2 text-xs font-semibold uppercase tracking-wide text-white/30">
        ระบบสำหรับช่าง
      </p>

      <nav className="mt-6 flex-1">
        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? "rounded-lg bg-[var(--brand)] px-3 py-2.5 text-sm font-semibold text-white"
                    : "rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <button
        onClick={handleSignOut}
        type="button"
        className="mt-4 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-white/50 transition hover:bg-white/5 hover:text-white"
      >
        ออกจากระบบ
      </button>
    </aside>
  );
}
