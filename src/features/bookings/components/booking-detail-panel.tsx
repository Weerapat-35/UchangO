"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  cancelCurrentUserBooking,
  getCurrentUserBookingById,
  type MyBooking,
} from "@/features/bookings";
import { createClient } from "@/lib/supabase/browser";
import { bookingStatusLabel, repairJobStatusLabel } from "@/lib/status-labels";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SignInPrompt } from "@/components/sign-in-prompt";
import {
  currencyFormatter,
  DateBadge,
  formatDateTimeThai,
  formatDuration,
  formatThaiDate,
  formatTime,
  getRelativeDay,
  getStatusMeta,
  PlusIcon,
  ProgressTracker,
  StatusBadge,
} from "./booking-ui";
import { RepairPaymentSection } from "./repair-payment-section";

type LoadState =
  | { status: "loading"; booking: null; error: null; userId: null }
  | { status: "signed-out"; booking: null; error: null; userId: null }
  | { status: "not-found"; booking: null; error: null; userId: string }
  | { status: "ready"; booking: MyBooking; error: null; userId: string }
  | { status: "error"; booking: null; error: string; userId: null };

type CancelState =
  | { status: "idle"; error: null }
  | { status: "cancelling"; error: null }
  | { status: "error"; error: string };

const REPAIR_STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  assigned: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  in_progress: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
};

function getRepairHint(booking: MyBooking) {
  const status = booking.repairJob?.status;

  if (!booking.repairJob) {
    return "อู่จะเปิดใบงานซ่อมหลังจากยืนยันการจอง และเตรียมรับรถของคุณ";
  }
  if (status === "pending") return "อู่เปิดใบงานแล้ว กำลังหาช่างที่เหมาะสมให้คุณ";
  if (status === "assigned") return "มอบหมายช่างแล้ว รอเริ่มงานซ่อม";
  if (status === "in_progress") return "ช่างกำลังดำเนินการซ่อมรถของคุณ";
  if (status === "completed") return "ซ่อมเสร็จเรียบร้อยแล้ว มารับรถได้เลย";
  return "งานซ่อมนี้ถูกยกเลิก";
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
        <h2 className="text-base font-extrabold text-[var(--foreground)] sm:text-lg">{title}</h2>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value, extra }: { label: string; value: ReactNode; extra?: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-3 first:pt-0 last:pb-0 sm:grid-cols-[170px_1fr] sm:gap-4">
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className="min-w-0 break-words text-[15px] font-bold text-[var(--foreground)]">
        {value}
        {extra ? <span className="mt-0.5 block text-sm font-normal text-[var(--muted)]">{extra}</span> : null}
      </dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-[var(--muted)] hover:text-[var(--foreground)]"
      href="/my-bookings"
    >
      <span aria-hidden="true">←</span>
      กลับไปการจองของฉัน
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="กำลังโหลดข้อมูลการจอง" className="animate-pulse space-y-4" role="status">
      <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <div className="flex gap-4">
          <div className="h-[76px] w-[68px] rounded-xl bg-slate-100" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-1/2 rounded bg-slate-100" />
            <div className="h-4 w-2/3 rounded bg-slate-100" />
          </div>
        </div>
        <div className="mt-5 h-20 rounded-xl bg-slate-100" />
      </div>
      <div className="h-40 rounded-2xl border border-[var(--line)] bg-white" />
      <div className="h-56 rounded-2xl border border-[var(--line)] bg-white" />
    </div>
  );
}

export function BookingDetailPanel({ bookingId }: { bookingId: string }) {
  const [loadState, setLoadState] = useState<LoadState>({
    booking: null,
    error: null,
    status: "loading",
    userId: null,
  });
  const [cancelState, setCancelState] = useState<CancelState>({
    error: null,
    status: "idle",
  });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadBooking() {
      setLoadState({
        booking: null,
        error: null,
        status: "loading",
        userId: null,
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
          booking: null,
          error: sessionError.message,
          status: "error",
          userId: null,
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          booking: null,
          error: null,
          status: "signed-out",
          userId: null,
        });
        return;
      }

      const { data, error } = await getCurrentUserBookingById(
        supabase,
        session.user.id,
        bookingId,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          booking: null,
          error: error.message,
          status: "error",
          userId: null,
        });
        return;
      }

      if (!data) {
        setLoadState({
          booking: null,
          error: null,
          status: "not-found",
          userId: session.user.id,
        });
        return;
      }

      setLoadState({
        booking: data,
        error: null,
        status: "ready",
        userId: session.user.id,
      });
    }

    void loadBooking();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadBooking();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [bookingId, reloadKey]);

  async function handleCancelBooking() {
    if (loadState.status !== "ready" || loadState.booking.status !== "pending") {
      return;
    }

    setCancelState({
      error: null,
      status: "cancelling",
    });
    setIsConfirmOpen(false);

    const supabase = createClient();
    const { data, error } = await cancelCurrentUserBooking(
      supabase,
      loadState.userId,
      loadState.booking.id,
    );

    if (error) {
      setCancelState({
        error: error.message,
        status: "error",
      });
      return;
    }

    if (!data) {
      setCancelState({
        error: "ยกเลิกได้เฉพาะการจองที่รอยืนยันเท่านั้น",
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      booking: {
        ...loadState.booking,
        status: data.status,
        updated_at: data.updated_at,
      },
    });
    setCancelState({
      error: null,
      status: "idle",
    });
  }

  const booking = loadState.status === "ready" ? loadState.booking : null;
  const isCancelling = cancelState.status === "cancelling";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-5 sm:px-6 sm:py-8">
      <div>
        <BackLink />
        <h1 className="mt-1 text-3xl font-extrabold text-[var(--foreground)]">รายละเอียดการจอง</h1>
      </div>

      {loadState.status === "loading" ? (
        <section className="py-6">
          <DetailSkeleton />
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <SignInPrompt title="กรุณาเข้าสู่ระบบ" message="เข้าสู่ระบบก่อนเพื่อดูการจองนี้" />
        </section>
      ) : null}

      {loadState.status === "not-found" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white px-6 py-8 text-center shadow-sm">
            <p className="text-lg font-bold text-[var(--foreground)]">ไม่พบการจองนี้</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              การจองนี้อาจถูกลบไปแล้ว หรือไม่ได้อยู่ในบัญชีของคุณ
            </p>
            <Link
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white hover:bg-[var(--brand-strong)]"
              href="/my-bookings"
            >
              ดูการจองทั้งหมดของฉัน
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white px-6 py-6 text-center shadow-sm">
            <p className="text-base font-bold text-red-700">โหลดข้อมูลไม่สำเร็จ</p>
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

      {booking ? (
        <div className="space-y-4 py-5">
          {/* สรุปสถานะ */}
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
            <div className="flex gap-3.5 p-4 sm:gap-4 sm:p-5">
              <DateBadge booking={booking} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <p className="text-xl font-extrabold leading-snug text-[var(--foreground)] sm:text-2xl">
                      {booking.service?.name ?? "ไม่พบข้อมูลบริการ"}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-[var(--muted)]">
                      <span>{formatThaiDate(booking.booking_date)}</span>
                      <span aria-hidden="true">•</span>
                      <span className="font-bold text-[var(--foreground)]">{formatTime(booking.booking_time)}</span>
                      {(() => {
                        const relativeDay = getRelativeDay(booking);
                        return relativeDay ? (
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
                        ) : null;
                      })()}
                    </p>
                  </div>
                  <StatusBadge label={bookingStatusLabel(booking.status)} status={booking.status} />
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{getStatusMeta(booking.status).hint}</p>
              </div>
            </div>

            {booking.status === "cancelled" ? (
              <div className="flex flex-col gap-3 border-t border-red-100 bg-red-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-sm leading-6 text-red-800">
                  หากยังต้องการใช้บริการ สามารถจองคิวใหม่ได้ทุกเมื่อ
                </p>
                <Link
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white hover:bg-[var(--brand-strong)]"
                  href="/"
                >
                  <PlusIcon />
                  จองคิวใหม่
                </Link>
              </div>
            ) : (
              <div className="border-t border-[var(--line)] bg-[var(--color-concrete-2)] px-3 py-4 sm:px-5">
                <ProgressTracker booking={booking} />
              </div>
            )}
          </section>

          {/* งานซ่อม + ช่าง */}
          {booking.status !== "cancelled" ? (
            <SectionCard
              action={
                booking.repairJob ? (
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ring-1 ring-inset ${
                      REPAIR_STATUS_STYLE[booking.repairJob.status] ?? REPAIR_STATUS_STYLE.pending
                    }`}
                  >
                    {repairJobStatusLabel(booking.repairJob.status)}
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600 ring-1 ring-inset ring-slate-200">
                    ยังไม่เริ่มงานซ่อม
                  </span>
                )
              }
              title="งานซ่อมของคุณ"
            >
              <p className="text-sm leading-6 text-[var(--muted)]">{getRepairHint(booking)}</p>

              {booking.repairJob ? (
                <>
                  <dl className="mt-4 divide-y divide-[var(--line)] border-t border-[var(--line)] pt-4">
                    <DetailRow
                      label="ช่างผู้รับผิดชอบ"
                      value={booking.repairJob.mechanic?.full_name ?? "ยังไม่ได้มอบหมาย"}
                    />
                    {booking.repairJob.mechanic?.phone_number ? (
                      <DetailRow
                        label="เบอร์โทรช่าง"
                        value={
                          <a
                            className="inline-flex min-h-10 items-center gap-2 text-[var(--brand)] underline-offset-2 hover:underline"
                            href={`tel:${booking.repairJob.mechanic.phone_number}`}
                          >
                            {booking.repairJob.mechanic.phone_number}
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold no-underline">แตะเพื่อโทร</span>
                          </a>
                        }
                      />
                    ) : null}
                    <DetailRow label="เริ่มงานเมื่อ" value={formatDateTimeThai(booking.repairJob.started_at)} />
                    <DetailRow label="ซ่อมเสร็จเมื่อ" value={formatDateTimeThai(booking.repairJob.completed_at)} />
                  </dl>

                  {booking.repairJob.diagnosis || booking.repairJob.repair_notes ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-[var(--color-concrete-2)] p-4">
                        <p className="text-sm font-bold text-[var(--foreground)]">ผลการตรวจเช็ก</p>
                        <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
                          {booking.repairJob.diagnosis || "ยังไม่มีข้อมูล"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--color-concrete-2)] p-4">
                        <p className="text-sm font-bold text-[var(--foreground)]">บันทึกการซ่อม</p>
                        <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
                          {booking.repairJob.repair_notes || "ยังไม่มีข้อมูล"}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </SectionCard>
          ) : null}

          {/* ชำระค่าซ่อม + ยืนยันรับรถ */}
          {loadState.status === "ready" && booking.status !== "cancelled" ? (
            <RepairPaymentSection
              booking={booking}
              onChanged={() => setReloadKey((value) => value + 1)}
              userId={loadState.userId}
            />
          ) : null}

          {/* ข้อมูลการจอง */}
          <SectionCard title="ข้อมูลการจอง">
            <dl className="divide-y divide-[var(--line)]">
              <DetailRow label="บริการ" value={booking.service?.name ?? "-"} />
              <DetailRow
                label="วันและเวลานัด"
                value={`${formatThaiDate(booking.booking_date)} เวลา ${formatTime(booking.booking_time)}`}
              />
              <DetailRow
                extra={[booking.vehicle?.brand, booking.vehicle?.model, booking.vehicle?.color].filter(Boolean).join(" · ") || undefined}
                label="รถ"
                value={booking.vehicle?.license_plate ?? "-"}
              />
              <DetailRow
                extra="ราคาจริงอาจเปลี่ยนตามอาการและอะไหล่ที่ใช้"
                label="ราคาเริ่มต้น"
                value={booking.service ? currencyFormatter.format(booking.service.base_price) : "-"}
              />
              <DetailRow
                label="เวลาโดยประมาณ"
                value={booking.service ? formatDuration(booking.service.estimated_duration_minutes) : "-"}
              />
              {booking.note ? <DetailRow label="หมายเหตุของคุณ" value={<span className="font-normal leading-6">{booking.note}</span>} /> : null}
            </dl>
          </SectionCard>

          {/* จัดการการจอง */}
          {booking.status !== "cancelled" ? (
            <SectionCard title="จัดการการจอง">
              {cancelState.status === "error" ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {cancelState.error}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--line)] bg-white px-5 text-sm font-bold text-[var(--foreground)] hover:border-slate-300"
                  href="/my-vehicles"
                >
                  แก้ไขข้อมูลรถ
                </Link>
                {booking.status === "pending" ? (
                  <button
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isCancelling}
                    onClick={() => setIsConfirmOpen(true)}
                    type="button"
                  >
                    {isCancelling ? "กำลังยกเลิก..." : "ยกเลิกการจองนี้"}
                  </button>
                ) : null}
              </div>

              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {booking.status === "pending"
                  ? "ยกเลิกเองได้ในระหว่างที่อู่ยังไม่ยืนยันคิว"
                  : booking.status === "confirmed"
                    ? "อู่ยืนยันคิวแล้ว จึงยกเลิกเองในระบบไม่ได้ หากต้องการเปลี่ยนแปลงกรุณาติดต่ออู่โดยตรง"
                    : "การจองนี้เสร็จสิ้นแล้ว"}
              </p>
            </SectionCard>
          ) : null}

          {/* ข้อมูลระบบ */}
          <p className="px-1 text-xs leading-6 text-[var(--muted)]">
            รหัสการจอง <span className="font-bold tracking-wide">#{booking.id.slice(0, 8).toUpperCase()}</span>
            {" · "}จองเมื่อ {formatDateTimeThai(booking.created_at)}
            {booking.updated_at !== booking.created_at ? <> · อัปเดตล่าสุด {formatDateTimeThai(booking.updated_at)}</> : null}
          </p>
        </div>
      ) : null}

      <ConfirmDialog
        cancelLabel="ไม่ยกเลิก"
        confirmLabel="ยืนยันยกเลิกการจอง"
        description={
          booking
            ? `การจอง${booking.service?.name ? ` "${booking.service.name}"` : ""} วัน${formatThaiDate(booking.booking_date)} เวลา ${formatTime(booking.booking_time)} จะถูกยกเลิก หากต้องการใช้บริการต้องจองใหม่`
            : ""
        }
        isLoading={isCancelling}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={handleCancelBooking}
        open={isConfirmOpen}
        title="ยกเลิกการจองนี้ใช่ไหม"
      />
    </main>
  );
}
