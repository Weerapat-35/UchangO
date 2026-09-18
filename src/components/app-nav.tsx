"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getCurrentProfile, type Profile } from "@/features/auth";
import { createClient } from "@/lib/supabase/browser";

const guestLinks = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/products", label: "สินค้า" },
  { href: "/auth", label: "เข้าสู่ระบบ" },
];

const customerLinks = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/products", label: "สินค้า" },
  { href: "/cart", label: "ตะกร้า" },
  { href: "/my-bookings", label: "การจองของฉัน" },
  { href: "/my-product-orders", label: "คำสั่งซื้อ" },
  { href: "/my-vehicles", label: "รถของฉัน" },
];

const technicianLinks = [
  { href: "/technician/work-orders", label: "งานซ่อมของฉัน" },
  { href: "/technician/profile", label: "โปรไฟล์ช่าง" },
];

const adminLinks = [
  { href: "/admin", label: "แดชบอร์ด" },
  { href: "/admin/bookings", label: "การจอง" },
  { href: "/admin/repair-jobs", label: "งานซ่อม" },
  { href: "/admin/schedule", label: "ตารางคิว" },
  { href: "/admin/products", label: "สินค้า" },
  { href: "/admin/product-orders", label: "ออเดอร์" },
  { href: "/admin/customers", label: "ลูกค้า" },
  { href: "/admin/reports", label: "รายงาน" },
];

export function AppNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile(nextUser: User | null) {
      if (!nextUser) {
        setProfile(null);
        return;
      }
      const { data } = await getCurrentProfile(supabase, nextUser.id);
      setProfile(data ?? null);
    }

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      loadProfile(session?.user ?? null);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      loadProfile(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const links = !user
    ? guestLinks
    : profile?.role === "admin"
      ? adminLinks
      : profile?.role === "technician"
        ? technicianLinks
        : customerLinks;

  // หน้า admin และช่างใช้ sidebar แทนแล้ว (ดู src/app/admin/layout.tsx,
  // src/app/technician/layout.tsx) ไม่ต้องโชว์แถบเมนูด้านบนซ้ำอีก
  if (pathname.startsWith("/admin") || pathname.startsWith("/technician")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40">
      {/* แถบสีแดงเข้มทึบด้านบนสุด ตามดีไซน์ */}
      <div className="h-2 bg-[var(--brand-strong)]" />

      <nav aria-label="เมนูหลัก" className="border-b border-[var(--line)] bg-white px-4 sm:px-6">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4">
          <Link
            href="/"
            className="shrink-0 font-display text-xl font-bold tracking-tight text-[var(--brand-strong)]"
          >
            อู่ช่างโอ
          </Link>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto">
            {links.map((link) => {
              const isActive =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    isActive
                      ? "shrink-0 whitespace-nowrap border-b-2 border-[var(--brand)] px-3 py-2 text-sm font-semibold text-[var(--brand)]"
                      : "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:text-[var(--brand)]"
                  }
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <>
                <Link
                  href="/auth"
                  className="hidden rounded-md px-3 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--brand)] sm:block"
                >
                  {profile?.full_name || "บัญชี"}
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]"
                >
                  ออกจากระบบ
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]"
              >
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
