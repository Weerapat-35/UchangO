"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getTechnicianWorkOrders,
  type TechnicianWorkOrder,
  type TechnicianWorkOrdersResult,
} from "@/features/technician";
import { createClient } from "@/lib/supabase/browser";
import { repairJobStatusLabel } from "@/lib/status-labels";
import { SignInPrompt } from "@/components/sign-in-prompt";

type LoadState =
  | { status: "loading"; result: null; error: null }
  | { status: "signed-out"; result: null; error: null }
  | { status: "ready"; result: TechnicianWorkOrdersResult; error: null }
  | { status: "error"; result: null; error: string };

type StatusFilter = "all" | TechnicianWorkOrder["status"];

const statusOrder: TechnicianWorkOrder["status"][] = [
  "pending",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
];

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("th-TH");
}

function formatBookingSchedule(workOrder: TechnicianWorkOrder) {
  if (!workOrder.booking) {
    return "ยังไม่มีนัดหมาย";
  }

  // booking_date เป็น YYYY-MM-DD ให้อ่านเป็นเวลาท้องถิ่น เพื่อไม่ให้วันเลื่อนตามเขตเวลา
  const date = new Date(`${workOrder.booking.booking_date}T00:00:00`);
  const dateText = Number.isNaN(date.getTime())
    ? workOrder.booking.booking_date
    : date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return `${dateText} · ${workOrder.booking.booking_time.slice(0, 5)} น.`;
}

function getStatusStyle(status: TechnicianWorkOrder["status"]) {
  if (status === "pending") {
    return "bg-amber-50 text-amber-800";
  }

  if (status === "assigned") {
    return "bg-cyan-50 text-cyan-800";
  }

  if (status === "in_progress") {
    return "bg-indigo-50 text-indigo-800";
  }

  if (status === "completed") {
    return "bg-emerald-50 text-emerald-800";
  }

  return "bg-red-50 text-red-700";
}

function TechnicianWorkOrderRow({
  workOrder,
}: {
  workOrder: TechnicianWorkOrder;
}) {
  const phone = workOrder.customer?.phone_number;
  const hasNotes = Boolean(workOrder.diagnosis || workOrder.repair_notes);

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusStyle(workOrder.status)}`}>
              {repairJobStatusLabel(workOrder.status)}
            </span>
            <p className="text-sm font-semibold text-[var(--brand)]">
              {workOrder.service?.name ?? "ไม่พบข้อมูลบริการ"}
            </p>
          </div>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {formatBookingSchedule(workOrder)}
          </h2>
        </div>

        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--brand)] px-5 text-sm font-semibold text-white"
          href={`/technician/work-orders/${workOrder.id}`}
        >
          เปิดใบงาน →
        </Link>
      </div>

      <div className="mt-5 grid gap-4 border-t border-[var(--line)] pt-5 sm:grid-cols-2">
        <div>
          <p className="text-sm text-[var(--muted)]">ลูกค้า</p>
          <p className="mt-1 font-semibold text-[var(--foreground)]">
            {workOrder.customer?.full_name ?? "-"}
          </p>
          {phone ? (
            <a className="mt-1 inline-flex min-h-9 items-center gap-1.5 font-semibold text-[var(--brand)] hover:underline" href={`tel:${phone}`}>
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>
              {phone}
            </a>
          ) : null}
        </div>
        <div>
          <p className="text-sm text-[var(--muted)]">รถ</p>
          <p className="mt-1 inline-flex rounded-md border-2 border-[var(--foreground)] bg-white px-2.5 py-0.5 font-bold tracking-wide text-[var(--foreground)]">
            {workOrder.vehicle?.license_plate ?? "-"}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {workOrder.vehicle
              ? [workOrder.vehicle.brand, workOrder.vehicle.model].filter(Boolean).join(" ") || "-"
              : "-"}
          </p>
        </div>
      </div>

      {hasNotes ? (
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          {workOrder.diagnosis ? (
            <div className="rounded-md bg-slate-50 p-3">
              <p className="font-semibold text-[var(--foreground)]">ผลการตรวจเช็ก</p>
              <p className="mt-1 leading-6 text-[var(--muted)]">{workOrder.diagnosis}</p>
            </div>
          ) : null}
          {workOrder.repair_notes ? (
            <div className="rounded-md bg-slate-50 p-3">
              <p className="font-semibold text-[var(--foreground)]">บันทึกการซ่อม</p>
              <p className="mt-1 leading-6 text-[var(--muted)]">{workOrder.repair_notes}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)]">
        <div className="flex gap-1.5">
          <dt>เริ่มงาน:</dt>
          <dd className="font-semibold text-[var(--foreground)]">{formatDateTime(workOrder.started_at)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>อัปเดตล่าสุด:</dt>
          <dd className="font-semibold text-[var(--foreground)]">{formatDateTime(workOrder.updated_at)}</dd>
        </div>
        {workOrder.completed_at ? (
          <div className="flex gap-1.5">
            <dt>เสร็จเมื่อ:</dt>
            <dd className="font-semibold text-[var(--foreground)]">{formatDateTime(workOrder.completed_at)}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

export function TechnicianWorkOrdersPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    error: null,
    result: null,
    status: "loading",
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadWorkOrders() {
      setLoadState({
        error: null,
        result: null,
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
          error: sessionError.message,
          result: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          error: null,
          result: null,
          status: "signed-out",
        });
        return;
      }

      const { data, error } = await getTechnicianWorkOrders(
        supabase,
        session.user.id,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          error: error.message,
          result: null,
          status: "error",
        });
        return;
      }

      setLoadState({
        error: null,
        result: data,
        status: "ready",
      });
    }

    void loadWorkOrders();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadWorkOrders();
    });

    const channel = supabase
      .channel("technician-work-orders-repair-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "repair_jobs" },
        () => {
          void loadWorkOrders();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, []);

  const statusCounts = useMemo(() => {
    const counts = new Map<TechnicianWorkOrder["status"], number>(
      statusOrder.map((status) => [status, 0]),
    );

    if (loadState.status !== "ready" || !loadState.result?.allowed) {
      return counts;
    }

    for (const workOrder of loadState.result.workOrders) {
      counts.set(workOrder.status, (counts.get(workOrder.status) ?? 0) + 1);
    }

    return counts;
  }, [loadState]);

  const filteredWorkOrders = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.result?.allowed) {
      return [];
    }

    if (statusFilter === "all") {
      return loadState.result.workOrders;
    }

    return loadState.result.workOrders.filter(
      (workOrder) => workOrder.status === statusFilter,
    );
  }, [loadState, statusFilter]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
      <header className="border-b border-[var(--line)] pb-5">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          งานซ่อมของฉัน
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          ดูงานซ่อมที่ได้รับมอบหมาย และอัปเดตสถานะ อาการเสีย และรายละเอียดการซ่อมได้จากหน้านี้
        </p>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดใบงานซ่อม...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <SignInPrompt title="กรุณาเข้าสู่ระบบ" message="กรุณาเข้าสู่ระบบด้วยบัญชีช่าง" showSignUp={false} />
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" && !loadState.result?.allowed ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            <p className="text-lg font-bold">ไม่มีสิทธิ์เข้าถึง</p>
            <p className="mt-2">{loadState.result?.reason}</p>
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" && loadState.result?.allowed ? (
        <section className="py-6">
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="กรองตามสถานะ">
            {(["all", ...statusOrder] as StatusFilter[]).map((status) => {
              const isActive = statusFilter === status;
              const count = status === "all" ? loadState.result!.workOrders.length : statusCounts.get(status) ?? 0;
              return (
                <button
                  aria-pressed={isActive}
                  className={`inline-flex min-h-11 flex-none items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                    isActive
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                      : "border-[var(--line)] bg-white text-[var(--foreground)] hover:border-[#c9ccd2]"
                  }`}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  type="button"
                >
                  {status === "all" ? "ทั้งหมด" : repairJobStatusLabel(status)}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-[var(--muted)]"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-sm text-[var(--muted)]">
            แสดง {filteredWorkOrders.length} จาก {loadState.result.workOrders.length} ใบงาน
          </p>

          {filteredWorkOrders.length > 0 ? (
            <div className="mt-5 space-y-4">
              {filteredWorkOrders.map((workOrder) => (
                <TechnicianWorkOrderRow
                  key={`${workOrder.id}-${workOrder.status}`}
                  workOrder={workOrder}
                />
              ))}
            </div>
          ) : loadState.result.workOrders.length > 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบใบงานที่ตรงกับตัวกรอง
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              ยังไม่มีใบงานที่มอบหมายให้คุณ
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
