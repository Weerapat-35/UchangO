"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  checkAdminAccess,
  getAdminBookingById,
  type AdminAccessResult,
  type AdminBooking,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; access: null; booking: null; error: null }
  | { status: "signed-out"; access: null; booking: null; error: null }
  | { status: "ready"; access: AdminAccessResult; booking: AdminBooking | null; error: null }
  | { status: "error"; access: null; booking: null; error: string };

const STATUS_LABEL: Record<AdminBooking["status"], string> = {
  cancelled: "ยกเลิก",
  completed: "เสร็จสิ้น",
  confirmed: "ยืนยันแล้ว",
  pending: "รอยืนยัน",
};

export function CheckinPanel({ bookingId }: { bookingId: string }) {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    booking: null,
    error: null,
    status: "loading",
  });
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  async function loadBooking() {
    const supabase = createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setLoadState({ access: null, booking: null, error: null, status: "signed-out" });
      return;
    }

    const access = await checkAdminAccess(supabase, session.user.id);

    if (!access.allowed) {
      setLoadState({ access, booking: null, error: null, status: "ready" });
      return;
    }

    const { data, error } = await getAdminBookingById(supabase, bookingId);

    if (error) {
      setLoadState({ access: null, booking: null, error: error.message, status: "error" });
      return;
    }

    setLoadState({ access, booking: data, error: null, status: "ready" });
  }

  useEffect(() => {
    loadBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  async function handleConfirmCheckin() {
    if (loadState.status !== "ready" || !loadState.booking) return;

    setIsConfirming(true);
    setConfirmError(null);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error } = await supabase
      .from("bookings")
      .update({
        checked_in_at: new Date().toISOString(),
        checked_in_by: session?.user.id ?? null,
      })
      .eq("id", bookingId);

    setIsConfirming(false);

    if (error) {
      setConfirmError(error.message);
      return;
    }

    await loadBooking();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="rounded-xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <p className="text-center text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
          เช็คอินลูกค้า
        </p>

        {loadState.status === "loading" ? (
          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            กำลังโหลดข้อมูล...
          </p>
        ) : null}

        {loadState.status === "signed-out" ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--muted)]">
              กรุณาเข้าสู่ระบบด้วยบัญชีพนักงานก่อน
            </p>
            <Link
              className="mt-4 inline-block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
              href="/auth"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        ) : null}

        {loadState.status === "error" ? (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
            {loadState.error}
          </p>
        ) : null}

        {loadState.status === "ready" && !loadState.access.allowed ? (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
            เฉพาะพนักงาน/แอดมินเท่านั้นที่เช็คอินให้ลูกค้าได้
          </p>
        ) : null}

        {loadState.status === "ready" && loadState.access.allowed ? (
          !loadState.booking ? (
            <p className="mt-6 text-center text-sm text-[var(--muted)]">
              ไม่พบการจองนี้ (QR อาจไม่ถูกต้องหรือถูกลบไปแล้ว)
            </p>
          ) : (
            <div className="mt-6">
              <div className="rounded-lg bg-[var(--concrete-2)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {STATUS_LABEL[loadState.booking.status]}
                </p>
                <h1 className="mt-1 text-xl font-bold text-[var(--foreground)]">
                  {loadState.booking.customer?.full_name ?? "ไม่ทราบชื่อ"}
                </h1>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {loadState.booking.vehicle?.license_plate ?? "-"} ·{" "}
                  {loadState.booking.service?.name ?? "-"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  วันที่จอง: {loadState.booking.booking_date}{" "}
                  {loadState.booking.booking_time?.slice(0, 5)}
                </p>
              </div>

              {loadState.booking.checked_in_at ? (
                <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
                  <p className="text-sm font-bold text-[var(--brand-strong)]">
                    ✓ เช็คอินแล้ว
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {new Date(loadState.booking.checked_in_at).toLocaleString("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              ) : (
                <button
                  className="mt-5 min-h-12 w-full rounded-md bg-[var(--brand)] text-base font-bold text-white shadow-sm transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isConfirming}
                  onClick={handleConfirmCheckin}
                  type="button"
                >
                  {isConfirming ? "กำลังยืนยัน..." : "✓ ยืนยันลูกค้ามาถึงแล้ว"}
                </button>
              )}

              {confirmError ? (
                <p className="mt-3 text-center text-sm text-red-700">{confirmError}</p>
              ) : null}

              <Link
                className="mt-4 block text-center text-sm font-semibold text-[var(--muted)] hover:text-[var(--brand)]"
                href={`/admin/bookings/${bookingId}`}
              >
                ดูรายละเอียดการจองเต็ม →
              </Link>
            </div>
          )
        ) : null}
      </div>
    </main>
  );
}
