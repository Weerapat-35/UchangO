"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCurrentUserBookings, type MyBooking } from "@/features/bookings";
import { createClient } from "@/lib/supabase/browser";
import { bookingStatusLabel, repairJobStatusLabel } from "@/lib/status-labels";
import { SignInPrompt } from "@/components/sign-in-prompt";
import {
  ArrowIcon,
  currencyFormatter,
  DateBadge,
  formatDuration,
  formatThaiDate,
  formatTime,
  getBookingTimestamp,
  getRelativeDay,
  getStatusMeta,
  isActiveBooking,
  PlusIcon,
  ProgressTracker,
  StatusBadge,
} from "./booking-ui";

type LoadState =
  | { status: "loading"; bookings: null; error: null }
  | { status: "signed-out"; bookings: null; error: null }
  | { status: "ready"; bookings: MyBooking[]; error: null }
  | { status: "error"; bookings: null; error: string };

type Filter = "all" | "active" | "completed" | "cancelled";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "active", label: "กำลังดำเนินการ" },
  { key: "completed", label: "เสร็จสิ้น" },
  { key: "cancelled", label: "ยกเลิก" },
];

/* ---------- ส่วนประกอบย่อย ---------- */

function InfoItem({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5 break-words text-[15px] font-bold text-[var(--foreground)]">{value}</dd>
      {extra ? <dd className="text-xs text-[var(--muted)]">{extra}</dd> : null}
    </div>
  );
}

function BookingCard({ booking }: { booking: MyBooking }) {
  const statusMeta = getStatusMeta(booking.status);
  const relativeDay = getRelativeDay(booking);
  const isCancelled = booking.status === "cancelled";
  const dateText = formatThaiDate(booking.booking_date);
  const vehicleExtra = [booking.vehicle?.brand, booking.vehicle?.model]
    .filter(Boolean)
    .join(" ");
  const mechanicName = booking.repairJob?.mechanic?.full_name;

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* ส่วนหัว: วันที่ + บริการ + สถานะ */}
      <div className="flex gap-3.5 p-4 sm:gap-4 sm:p-5">
        <DateBadge booking={booking} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-snug text-[var(--foreground)] sm:text-xl">
                {booking.service?.name ?? "ไม่พบข้อมูลบริการ"}
              </h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]">
                <span>{dateText}</span>
                <span aria-hidden="true">•</span>
                <span className="font-bold text-[var(--foreground)]">{formatTime(booking.booking_time)}</span>
                {relativeDay ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      relativeDay.tone === "hot"
                        ? "bg-[var(--brand)] text-white"
                        : relativeDay.tone === "warn"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {relativeDay.label}
                  </span>
                ) : null}
              </p>
            </div>
            <StatusBadge label={bookingStatusLabel(booking.status)} status={booking.status} />
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">{statusMeta.hint}</p>
        </div>
      </div>

      {/* ความคืบหน้า */}
      {isCancelled ? (
        <div className="mx-4 mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-800 sm:mx-5">
          หากยังต้องการใช้บริการ สามารถจองคิวใหม่ได้ทุกเมื่อ
        </div>
      ) : (
        <div className="mx-4 mb-4 rounded-xl bg-[var(--color-concrete-2)] px-3 py-4 sm:mx-5 sm:px-5">
          <ProgressTracker booking={booking} />
          <p className="mt-3 border-t border-[var(--line)] pt-3 text-sm text-[var(--muted)]">
            งานซ่อม:{" "}
            <span className="font-bold text-[var(--foreground)]">
              {booking.repairJob
                ? repairJobStatusLabel(booking.repairJob.status)
                : "ยังไม่เริ่มงานซ่อม"}
            </span>
            {" · "}ช่างผู้ดูแล:{" "}
            <span className="font-bold text-[var(--foreground)]">
              {mechanicName ?? "ยังไม่ได้มอบหมาย"}
            </span>
          </p>
        </div>
      )}

      {/* รายละเอียดสรุป */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-[var(--line)] px-4 py-4 sm:grid-cols-3 sm:px-5">
        <InfoItem
          extra={vehicleExtra || undefined}
          label="ทะเบียนรถ"
          value={booking.vehicle?.license_plate ?? "-"}
        />
        <InfoItem
          label="ราคาเริ่มต้น"
          value={booking.service ? currencyFormatter.format(booking.service.base_price) : "-"}
        />
        <InfoItem
          label="เวลาโดยประมาณ"
          value={booking.service ? formatDuration(booking.service.estimated_duration_minutes) : "-"}
        />
      </dl>

      {booking.note ? (
        <div className="mx-4 mb-4 rounded-xl border border-[var(--line)] px-4 py-3 text-sm leading-6 sm:mx-5">
          <span className="font-bold text-[var(--foreground)]">หมายเหตุของคุณ: </span>
          <span className="text-[var(--muted)]">{booking.note}</span>
        </div>
      ) : null}

      {/* ปุ่มดำเนินการ */}
      <div className="flex flex-col gap-3 border-t border-[var(--line)] bg-[var(--color-concrete)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-xs text-[var(--muted)]">
          รหัสการจอง <span className="font-bold tracking-wide">#{booking.id.slice(0, 8).toUpperCase()}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {booking.vehicle ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-bold text-[var(--foreground)] hover:border-slate-300"
              href="/my-vehicles"
            >
              แก้ไขข้อมูลรถ
            </Link>
          ) : null}
          <Link
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white shadow-sm hover:bg-[var(--brand-strong)] sm:flex-none"
            href={`/my-bookings/${booking.id}`}
          >
            ดูรายละเอียด
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </article>
  );
}

function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="กำลังโหลดรายการจอง" className="space-y-4" role="status">
      {[0, 1, 2].map((item) => (
        <div className="animate-pulse rounded-2xl border border-[var(--line)] bg-white p-5" key={item}>
          <div className="flex gap-4">
            <div className="h-[76px] w-[68px] rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-1/2 rounded bg-slate-100" />
              <div className="h-4 w-2/3 rounded bg-slate-100" />
              <div className="h-4 w-1/3 rounded bg-slate-100" />
            </div>
          </div>
          <div className="mt-5 h-16 rounded-xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ filtered, onShowAll }: { filtered: boolean; onShowAll: () => void }) {
  if (filtered) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
        <p className="text-base font-bold text-[var(--foreground)]">ไม่มีรายการในหมวดนี้</p>
        <button
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[var(--line)] px-5 text-sm font-bold text-[var(--foreground)] hover:border-slate-300"
          onClick={onShowAll}
          type="button"
        >
          ดูรายการทั้งหมด
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-14 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-[var(--brand)]">
        <svg aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <rect height="17" rx="2" width="18" x="3" y="4" />
          <path d="M3 9h18M8 2v4M16 2v4" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-bold text-[var(--foreground)]">ยังไม่มีการจองคิว</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[var(--muted)]">
        เลือกบริการที่ต้องการ แล้วเลือกวันและเวลาที่สะดวก ใช้เวลาไม่กี่นาที
      </p>
      <Link
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white shadow-sm hover:bg-[var(--brand-strong)]"
        href="/"
      >
        <PlusIcon />
        จองคิวแรกของคุณ
      </Link>
    </div>
  );
}

/* ---------- หน้าหลัก ---------- */

export function MyBookingsPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    bookings: null,
    error: null,
    status: "loading",
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadBookings() {
      setLoadState({
        bookings: null,
        error: null,
        status: "loading",
      });

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setLoadState({
          bookings: null,
          error: sessionError.message,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          bookings: null,
          error: null,
          status: "signed-out",
        });
        return;
      }

      const { data, error } = await getCurrentUserBookings(
        supabase,
        session.user.id,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          bookings: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setLoadState({
        bookings: data ?? [],
        error: null,
        status: "ready",
      });
    }

    void loadBookings();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadBookings();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [reloadKey]);

  const bookings = loadState.status === "ready" ? loadState.bookings : null;

  const counts = useMemo(() => {
    const list = bookings ?? [];
    return {
      all: list.length,
      active: list.filter(isActiveBooking).length,
      completed: list.filter((item) => item.status === "completed").length,
      cancelled: list.filter((item) => item.status === "cancelled").length,
    } satisfies Record<Filter, number>;
  }, [bookings]);

  // รายการที่ยังดำเนินการอยู่ขึ้นก่อน (เรียงจากใกล้ถึงวันนัดที่สุด) ตามด้วยรายการที่จบแล้ว (ใหม่สุดก่อน)
  const visibleBookings = useMemo(() => {
    const list = bookings ?? [];
    const filtered = list.filter((item) => {
      if (filter === "active") return isActiveBooking(item);
      if (filter === "completed") return item.status === "completed";
      if (filter === "cancelled") return item.status === "cancelled";
      return true;
    });

    const active = filtered
      .filter(isActiveBooking)
      .sort((a, b) => getBookingTimestamp(a).localeCompare(getBookingTimestamp(b)));
    const finished = filtered
      .filter((item) => !isActiveBooking(item))
      .sort((a, b) => getBookingTimestamp(b).localeCompare(getBookingTimestamp(a)));

    return [...active, ...finished];
  }, [bookings, filter]);

  const subtitle =
    loadState.status === "ready" && counts.active > 0
      ? `มี ${counts.active} รายการที่กำลังดำเนินการ`
      : "รายการจองคิวทั้งหมดในบัญชีของคุณ";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[var(--foreground)]">
            การจองของฉัน
          </h1>
          <p className="mt-1.5 text-[15px] text-[var(--muted)]">{subtitle}</p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white shadow-sm hover:bg-[var(--brand-strong)]"
          href="/"
        >
          <PlusIcon />
          จองคิวใหม่
        </Link>
      </header>

      {loadState.status === "ready" && counts.all > 0 ? (
        <nav aria-label="กรองรายการจอง" className="-mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {FILTERS.map((item) => {
              const selected = filter === item.key;
              return (
                <button
                  aria-pressed={selected}
                  className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-bold transition-colors ${
                    selected
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                      : "border-[var(--line)] bg-white text-[var(--foreground)] hover:border-slate-300"
                  }`}
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  type="button"
                >
                  {item.label}
                  <span
                    className={`grid min-w-6 place-items-center rounded-full px-1.5 text-xs ${
                      selected ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {counts[item.key]}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      ) : null}

      {loadState.status === "loading" ? (
        <section className="py-6">
          <LoadingSkeleton />
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <SignInPrompt title="กรุณาเข้าสู่ระบบ" message="เข้าสู่ระบบก่อนเพื่อดูรายการจองของคุณ" />
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-2xl border border-red-200 bg-white px-6 py-6 text-center shadow-sm">
            <p className="text-base font-bold text-red-700">โหลดรายการจองไม่สำเร็จ</p>
            <p className="mt-1 break-words text-sm text-[var(--muted)]">{loadState.error}</p>
            <button
              className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white"
              onClick={() => setReloadKey((value) => value + 1)}
              type="button"
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="py-5">
          {visibleBookings.length > 0 ? (
            <div className="space-y-4">
              {visibleBookings.map((booking) => (
                <BookingCard booking={booking} key={booking.id} />
              ))}
            </div>
          ) : (
            <EmptyState filtered={counts.all > 0} onShowAll={() => setFilter("all")} />
          )}
        </section>
      ) : null}
    </main>
  );
}
