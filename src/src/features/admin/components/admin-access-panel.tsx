"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  checkAdminAccess,
  getAdminBookings,
  getAdminDashboardOverview,
  type AdminAccessResult,
  type AdminBooking,
  type AdminDashboardOverview,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type DashboardCounts = Record<AdminBooking["status"], number>;

type LoadState =
  | { status: "loading"; access: null; bookings: null; overview: null; error: null }
  | { status: "signed-out"; access: null; bookings: null; overview: null; error: null }
  | {
      status: "ready";
      access: AdminAccessResult;
      bookings: AdminBooking[] | null;
      overview: AdminDashboardOverview | null;
      error: null;
    }
  | { status: "error"; access: null; bookings: null; overview: null; error: string };

const STATUS_ORDER: AdminBooking["status"][] = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
];

const STATUS_LABEL: Record<AdminBooking["status"], string> = {
  cancelled: "ยกเลิก",
  completed: "เสร็จสิ้น",
  confirmed: "ยืนยันแล้ว",
  pending: "รอยืนยัน",
};

function formatTime(time: string) {
  return time.slice(0, 5);
}

function formatBaht(value: number) {
  return `฿${value.toLocaleString("th-TH")}`;
}

function formatShortDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function getStatusStyle(status: AdminBooking["status"]) {
  if (status === "pending") return "bg-amber-50 text-amber-800";
  if (status === "confirmed") return "bg-emerald-50 text-[var(--brand-strong)]";
  if (status === "cancelled") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function getDashboardCounts(bookings: AdminBooking[]) {
  return bookings.reduce<DashboardCounts>(
    (counts, booking) => ({
      ...counts,
      [booking.status]: counts[booking.status] + 1,
    }),
    { cancelled: 0, completed: 0, confirmed: 0, pending: 0 },
  );
}

function StatCard({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: string;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link
      className={
        accent
          ? "rounded-xl bg-[var(--brand)] p-5 text-white shadow-sm transition hover:bg-[var(--brand-strong)]"
          : "rounded-xl border border-[var(--line)] bg-white p-5 shadow-sm transition hover:border-[var(--brand)]"
      }
      href={href}
    >
      <p
        className={
          accent
            ? "text-sm font-semibold text-white/80"
            : "text-sm font-semibold text-[var(--muted)]"
        }
      >
        {label}
      </p>
      <p className={accent ? "mt-2 text-3xl font-bold" : "mt-2 text-3xl font-bold text-[var(--foreground)]"}>
        {value}
      </p>
    </Link>
  );
}

/** กราฟแท่งรายได้ 14 วันล่าสุด วาดด้วย SVG ธรรมดา ไม่ต้องพึ่ง library ภายนอก */
function RevenueChart({ data }: { data: AdminDashboardOverview["dailyRevenue"] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const width = 700;
  const height = 220;
  const barGap = 6;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;

  return (
    <div className="overflow-x-auto">
      <svg
        className="w-full"
        height={height + 30}
        viewBox={`0 0 ${width} ${height + 30}`}
        preserveAspectRatio="none"
      >
        {data.map((point, index) => {
          const barHeight = (point.revenue / max) * (height - 10);
          const x = index * (barWidth + barGap);
          const y = height - barHeight;

          return (
            <g key={point.date}>
              <rect
                fill={point.revenue > 0 ? "var(--brand)" : "var(--concrete-2)"}
                height={Math.max(barHeight, 2)}
                rx={3}
                width={barWidth}
                x={x}
                y={y}
              >
                <title>
                  {formatShortDate(point.date)}: {formatBaht(point.revenue)}
                </title>
              </rect>
              {index % 2 === 0 ? (
                <text
                  fill="var(--muted)"
                  fontSize="10"
                  textAnchor="middle"
                  x={x + barWidth / 2}
                  y={height + 18}
                >
                  {formatShortDate(point.date)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RecentBookingRow({ booking }: { booking: AdminBooking }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--brand)]">
              {booking.service?.name ?? "ไม่พบบริการ"}
            </p>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                booking.status,
              )}`}
            >
              {STATUS_LABEL[booking.status]}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-bold text-[var(--foreground)]">
            {booking.booking_date} เวลา {formatTime(booking.booking_time)}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {booking.customer?.full_name ?? "-"} /{" "}
            {booking.vehicle?.license_plate ?? "-"}
          </p>
        </div>
        <Link
          className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
          href={`/admin/bookings/${booking.id}`}
        >
          ดูรายละเอียด
        </Link>
      </div>
    </article>
  );
}

export function AdminAccessPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    bookings: null,
    overview: null,
    error: null,
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadDashboard() {
      setLoadState({
        access: null,
        bookings: null,
        overview: null,
        error: null,
        status: "loading",
      });

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (sessionError) {
        setLoadState({
          access: null,
          bookings: null,
          overview: null,
          error: sessionError.message,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          bookings: null,
          overview: null,
          error: null,
          status: "signed-out",
        });
        return;
      }

      const access = await checkAdminAccess(supabase, session.user.id);

      if (!isMounted) return;

      if (!access.allowed) {
        setLoadState({
          access,
          bookings: null,
          overview: null,
          error: null,
          status: "ready",
        });
        return;
      }

      const [bookingsResult, overviewResult] = await Promise.all([
        getAdminBookings(supabase),
        getAdminDashboardOverview(supabase),
      ]);

      if (!isMounted) return;

      if (bookingsResult.error) {
        setLoadState({
          access: null,
          bookings: null,
          overview: null,
          error: bookingsResult.error.message,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        bookings: bookingsResult.data ?? [],
        overview: overviewResult.data,
        error: null,
        status: "ready",
      });
    }

    loadDashboard();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadDashboard();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const counts = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.bookings) {
      return getDashboardCounts([]);
    }
    return getDashboardCounts(loadState.bookings);
  }, [loadState]);

  const recentBookings = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.bookings) return [];
    return loadState.bookings.slice(0, 5);
  }, [loadState]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
      <header className="border-b border-[var(--line)] pb-5">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          แดชบอร์ดภาพรวม
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          สรุปยอดจอง รายได้ งานซ่อมค้าง และสต็อกสินค้าใกล้หมด
        </p>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดแดชบอร์ด...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อน</p>
            <p className="mt-1">กรุณาเข้าสู่ระบบเพื่อตรวจสอบสิทธิ์แอดมิน</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปหน้าบัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="py-6">
          {loadState.access.allowed ? (
            <div className="space-y-6">
              {loadState.overview ? (
                <>
                  <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      accent
                      href="/admin/reports"
                      label="รายได้วันนี้ (โดยประมาณ)"
                      value={formatBaht(loadState.overview.revenueToday)}
                    />
                    <StatCard
                      href="/admin/bookings"
                      label="การจองวันนี้"
                      value={String(loadState.overview.bookingsToday)}
                    />
                    <StatCard
                      href="/admin/repair-jobs"
                      label="งานซ่อมที่ยังไม่เสร็จ"
                      value={String(loadState.overview.pendingRepairJobCount)}
                    />
                    <StatCard
                      href="/admin/inventory"
                      label="สินค้าใกล้หมด (≤5 ชิ้น)"
                      value={String(loadState.overview.lowStockCount)}
                    />
                  </section>

                  <section className="rounded-xl border border-[var(--line)] bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-[var(--foreground)]">
                        รายได้ย้อนหลัง 14 วัน (จากการจองบริการ)
                      </h2>
                      <Link
                        className="text-sm font-semibold text-[var(--brand)] hover:underline"
                        href="/admin/reports"
                      >
                        ดูรายงานเต็ม →
                      </Link>
                    </div>
                    <div className="mt-4">
                      <RevenueChart data={loadState.overview.dailyRevenue} />
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      * นับเฉพาะการจองที่ยืนยันหรือเสร็จสิ้นแล้ว ยังไม่รวมยอดขายสินค้า
                    </p>
                  </section>

                  {loadState.overview.lowStockProducts.length > 0 ? (
                    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                      <h2 className="text-sm font-bold text-amber-900">
                        ⚠️ สินค้าใกล้หมดสต็อก
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {loadState.overview.lowStockProducts.map((product) => (
                          <Link
                            key={product.id}
                            href="/admin/inventory"
                            className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800"
                          >
                            {product.name} — เหลือ {product.stock_quantity} ชิ้น
                          </Link>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {STATUS_ORDER.map((status) => (
                  <Link
                    className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm transition hover:border-[var(--brand)]"
                    href={`/admin/bookings?status=${status}`}
                    key={status}
                  >
                    <p className="text-sm font-semibold text-[var(--muted)]">
                      {STATUS_LABEL[status]}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
                      {counts[status]}
                    </p>
                  </Link>
                ))}
              </section>

              <div>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-bold text-[var(--foreground)]">
                    การจองล่าสุด
                  </h2>
                  <Link
                    className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--brand)]"
                    href="/admin/bookings"
                  >
                    ดูทั้งหมด
                  </Link>
                </div>
                {recentBookings.length > 0 ? (
                  <div className="space-y-3">
                    {recentBookings.map((booking) => (
                      <RecentBookingRow booking={booking} key={booking.id} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
                    ยังไม่มีการจอง
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
              <p className="text-lg font-bold">ไม่มีสิทธิ์เข้าถึง</p>
              <p className="mt-2">{loadState.access.reason}</p>
              {loadState.access.profile ? (
                <p className="mt-2 text-xs">
                  สิทธิ์ปัจจุบัน: {loadState.access.profile.role ?? "ไม่ทราบ"}
                </p>
              ) : null}
              <Link
                className="mt-5 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
                href="/auth"
              >
                ไปหน้าบัญชี
              </Link>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
