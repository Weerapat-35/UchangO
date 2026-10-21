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
      className={`admin-stat-card ${accent ? "admin-stat-card--accent" : ""}`}
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
    <article className="admin-recent-booking">
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
  const [loadState, setLoadState] = useState<LoadState>({ access:null, bookings:null, overview:null, error:null, status:"loading" });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();
    async function loadDashboard() {
      setLoadState({access:null,bookings:null,overview:null,error:null,status:"loading"});
      const { data:{session}, error:sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) { setLoadState({access:null,bookings:null,overview:null,error:sessionError.message,status:"error"}); return; }
      if (!session?.user) { setLoadState({access:null,bookings:null,overview:null,error:null,status:"signed-out"}); return; }
      const access = await checkAdminAccess(supabase, session.user.id);
      if (!isMounted) return;
      if (!access.allowed) { setLoadState({access,bookings:null,overview:null,error:null,status:"ready"}); return; }
      const [bookingsResult, overviewResult] = await Promise.all([getAdminBookings(supabase), getAdminDashboardOverview(supabase)]);
      if (!isMounted) return;
      if (bookingsResult.error) { setLoadState({access:null,bookings:null,overview:null,error:bookingsResult.error.message,status:"error"}); return; }
      setLoadState({access,bookings:bookingsResult.data ?? [],overview:overviewResult.data,error:null,status:"ready"});
    }
    loadDashboard();
    const { data:{subscription} } = supabase.auth.onAuthStateChange(() => { loadDashboard(); });
    return () => { isMounted=false; subscription.unsubscribe(); };
  }, []);

  const counts = useMemo(() => loadState.status === "ready" && loadState.bookings ? getDashboardCounts(loadState.bookings) : getDashboardCounts([]), [loadState]);
  const recentBookings = useMemo(() => loadState.status === "ready" && loadState.bookings ? loadState.bookings.slice(0,5) : [], [loadState]);

  return <main className="admin-dashboard-page">
    {loadState.status === "loading" ? <section className="admin-state-card"><div className="admin-loading-dot"/><strong>กำลังโหลดข้อมูลแดชบอร์ด...</strong></section> : null}
    {loadState.status === "signed-out" ? <section className="admin-state-card admin-state-card--warning"><strong>ต้องเข้าสู่ระบบก่อน</strong><p>กรุณาเข้าสู่ระบบเพื่อตรวจสอบสิทธิ์แอดมิน</p><Link href="/auth">ไปหน้าบัญชี</Link></section> : null}
    {loadState.status === "error" ? <section className="admin-state-card admin-state-card--error"><strong>ไม่สามารถโหลดข้อมูลได้</strong><p>{loadState.error}</p></section> : null}

    {loadState.status === "ready" ? loadState.access.allowed ? <>
      <section className="admin-welcome">
        <div className="admin-welcome__identity"><div className="admin-welcome__avatar">A</div><div><h2>ยินดีต้อนรับกลับ 👋</h2></div></div>
        <div className="admin-welcome__actions"><Link href="/admin/bookings" className="admin-btn admin-btn--dark">+ สร้างงานซ่อม</Link><Link href="/admin/reports" className="admin-btn admin-btn--red">ดูรายงาน</Link></div>
      </section>

      <nav className="admin-dashboard-tabs" aria-label="ส่วนของแดชบอร์ด">
        <Link className="is-active" href="/admin">ภาพรวม</Link><Link href="/admin/repair-jobs">งานซ่อม</Link><Link href="/admin/finance">การเงิน</Link><Link href="/admin/reports">รายงาน</Link>
      </nav>

      {loadState.overview ? <section className="admin-stat-grid">
        <StatCard accent href="/admin/reports" label="รายได้วันนี้" value={formatBaht(loadState.overview.revenueToday)} />
        <StatCard href="/admin/bookings" label="การจองวันนี้" value={String(loadState.overview.bookingsToday)} />
        <StatCard href="/admin/repair-jobs" label="งานซ่อมค้าง" value={String(loadState.overview.pendingRepairJobCount)} />
        <StatCard href="/admin/inventory" label="สินค้าใกล้หมด" value={String(loadState.overview.lowStockCount)} />
      </section> : null}

      <section className="admin-dashboard-grid">
        <div className="admin-panel admin-panel--chart">
          <div className="admin-panel__heading"><div><p>รายรับจากบริการ</p><h3>รายได้ย้อนหลัง 14 วัน</h3></div><Link href="/admin/reports">ดูรายงานเต็ม →</Link></div>
          {loadState.overview ? <RevenueChart data={loadState.overview.dailyRevenue}/> : null}
          <p className="admin-panel__note">นับเฉพาะการจองที่ยืนยันหรือเสร็จสิ้นแล้ว ยังไม่รวมยอดขายสินค้า</p>
        </div>
        <div className="admin-panel admin-panel--status">
          <div className="admin-panel__heading"><div><p>สถานะงาน</p><h3>การจองวันนี้</h3></div><Link href="/admin/bookings">ทั้งหมด</Link></div>
          <div className="admin-status-list">{STATUS_ORDER.map((status,index)=><Link key={status} href={`/admin/bookings?status=${status}`} className="admin-status-row"><span className={`admin-status-dot admin-status-dot--${index}`}/><span>{STATUS_LABEL[status]}</span><strong>{counts[status]}</strong></Link>)}</div>
        </div>
      </section>

      <section className="admin-lower-grid">
        <div className="admin-panel">
          <div className="admin-panel__heading"><div><p>รายการล่าสุด</p><h3>การจองล่าสุด</h3></div><Link href="/admin/bookings">ดูทั้งหมด →</Link></div>
          <div className="admin-booking-list">{recentBookings.length ? recentBookings.map((booking)=><RecentBookingRow booking={booking} key={booking.id}/>) : <div className="admin-empty">ยังไม่มีการจอง</div>}</div>
        </div>
        <div className="admin-panel admin-stock-panel">
          <div className="admin-panel__heading"><div><p>คลังสินค้า</p><h3>รายการที่ควรตรวจสอบ</h3></div><Link href="/admin/inventory">ดูคลัง →</Link></div>
          {loadState.overview?.lowStockProducts.length ? <div className="admin-stock-list">{loadState.overview.lowStockProducts.slice(0,5).map(product=><Link href="/admin/inventory" key={product.id} className="admin-stock-row"><span className="admin-stock-icon">!</span><span><strong>{product.name}</strong><small>คงเหลือ {product.stock_quantity} ชิ้น</small></span><b>ตรวจ</b></Link>)}</div> : <div className="admin-empty admin-empty--good"><span>✓</span> ไม่มีสินค้าใกล้หมด</div>}
        </div>
      </section>
    </> : <section className="admin-state-card admin-state-card--error"><strong>ไม่มีสิทธิ์เข้าถึง</strong><p>{loadState.access.reason}</p>{loadState.access.profile ? <small>สิทธิ์ปัจจุบัน: {loadState.access.profile.role ?? "ไม่ทราบ"}</small> : null}<Link href="/auth">ไปหน้าบัญชี</Link></section> : null}
  </main>;
}
