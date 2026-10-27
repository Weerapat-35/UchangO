"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  checkAdminAccess,
  getAdminMechanics,
  getAdminRepairJobs,
  updateAdminRepairJobMechanic,
  type AdminMechanic,
  type AdminRepairJob,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";
import { repairJobStatusLabel } from "@/lib/status-labels";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminIcon,
  AdminLoadMessage,
  AdminModal,
  AdminPageIntro,
  AdminPill,
  AdminPlate,
  AdminToast,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  type AdminPillTone,
} from "./admin-list-ui";

type LoadState =
  | { status: "loading" | "signed-out"; message: null; repairJobs: null }
  | { status: "access-denied" | "error"; message: string; repairJobs: null }
  | { status: "ready"; message: null; repairJobs: AdminRepairJob[] };

/** open = งานที่ยังไม่เสร็จ (รอมอบหมาย มอบหมายแล้ว กำลังซ่อม) */
type StatusFilter = "open" | "all" | AdminRepairJob["status"];

const statusOrder: AdminRepairJob["status"][] = ["pending", "assigned", "in_progress", "completed", "cancelled"];

// โทนสีตามเว็บ: รอมอบหมาย = กรอบแดง / มอบหมายแล้ว = ดำ / กำลังซ่อม = แดงทึบ / เสร็จ = เขียว / ยกเลิก = เทา
const STATUS_TONE: Record<string, AdminPillTone> = {
  pending: "attention",
  assigned: "dark",
  in_progress: "brand",
  completed: "done",
  cancelled: "muted",
};

function isClosed(repairJob: AdminRepairJob) {
  return repairJob.status === "completed" || repairJob.status === "cancelled";
}

function getMechanicSkillsLabel(mechanic: AdminMechanic | null) {
  if (!mechanic) return "";
  if (mechanic.skills.length > 0) return mechanic.skills.map((skill) => skill.name).join(", ");
  return mechanic.technician_specialty?.trim() || "ยังไม่ได้ระบุทักษะ";
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function bookingSortKey(repairJob: AdminRepairJob) {
  return repairJob.booking ? `${repairJob.booking.booking_date} ${repairJob.booking.booking_time}` : repairJob.created_at;
}

function MechanicAvatar({ name }: { name: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-asphalt)] text-sm font-bold text-white">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function InfoBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-[var(--muted)]">{label}</dt>
      <dd className="mt-1.5 text-sm text-[var(--foreground)]">{children}</dd>
    </div>
  );
}

function AssignMechanicModal({
  mechanics,
  onClose,
  onSave,
  repairJob,
  saving,
}: {
  mechanics: AdminMechanic[];
  onClose: () => void;
  onSave: (mechanicId: string | null) => void;
  repairJob: AdminRepairJob;
  saving: boolean;
}) {
  const [selectedId, setSelectedId] = useState(repairJob.mechanic_id ?? "");
  // ช่างที่มอบหมายไว้แล้วแต่ไม่อยู่ในรายชื่อช่าง (เช่น เปลี่ยน role ไปแล้ว) ยังต้องแสดงให้เห็น
  const options = repairJob.mechanic && !mechanics.some((mechanic) => mechanic.id === repairJob.mechanic?.id)
    ? [repairJob.mechanic, ...mechanics]
    : mechanics;

  return (
    <AdminModal
      description={`${repairJob.service?.name ?? "งานซ่อม"} · ${repairJob.vehicle?.license_plate ?? "-"} · ${repairJob.customer?.full_name ?? "-"}`}
      footer={
        <>
          <button className={adminSecondaryButtonClass} onClick={onClose} type="button">ยกเลิก</button>
          <button className={adminPrimaryButtonClass} disabled={saving || selectedId === (repairJob.mechanic_id ?? "")} onClick={() => onSave(selectedId || null)} type="button">
            {saving ? "กำลังบันทึก..." : "บันทึกช่าง"}
          </button>
        </>
      }
      onClose={onClose}
      open
      title={repairJob.mechanic_id ? "เปลี่ยนช่างที่รับผิดชอบ" : "มอบหมายช่าง"}
    >
      {options.length === 0 ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">ยังไม่มีบัญชีช่างในระบบ</p>
      ) : (
        <fieldset className="space-y-2">
          <legend className="sr-only">เลือกช่าง</legend>
          {[{ id: "", full_name: "ยังไม่มอบหมาย", skillsLabel: "งานจะรอในคิวจนกว่าจะเลือกช่าง" }, ...options.map((mechanic) => ({ id: mechanic.id, full_name: mechanic.full_name, skillsLabel: getMechanicSkillsLabel(mechanic) }))].map((option) => {
            const checked = selectedId === option.id;
            return (
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${checked ? "border-[var(--color-safety)] bg-red-50/50 ring-4 ring-red-50" : "border-[var(--line)] hover:border-slate-300"}`} key={option.id || "none"}>
                <input checked={checked} className="sr-only" name="mechanic" onChange={() => setSelectedId(option.id)} type="radio" />
                {option.id ? <MechanicAvatar name={option.full_name} /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-concrete-2)] text-[var(--muted)]">–</span>}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[var(--foreground)]">{option.full_name}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">{option.skillsLabel}</span>
                </span>
                <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${checked ? "border-[var(--color-safety)] bg-[var(--color-safety)] shadow-[inset_0_0_0_3px_white]" : "border-slate-300"}`} aria-hidden="true" />
              </label>
            );
          })}
        </fieldset>
      )}
    </AdminModal>
  );
}

function RepairJobCard({ onAssign, repairJob }: { onAssign: () => void; repairJob: AdminRepairJob }) {
  const closed = isClosed(repairJob);
  const needsMechanic = !closed && !repairJob.mechanic_id;
  const date = repairJob.booking ? new Date(`${repairJob.booking.booking_date}T00:00:00`) : null;
  const vehicleName = repairJob.vehicle ? [repairJob.vehicle.brand, repairJob.vehicle.model, repairJob.vehicle.color].filter(Boolean).join(" ") : "";
  const started = formatDateTime(repairJob.started_at);
  const completed = formatDateTime(repairJob.completed_at);

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${needsMechanic ? "border-[var(--color-safety)]/40" : "border-[var(--line)]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--color-safety)]">{repairJob.service?.name ?? "ไม่พบข้อมูลบริการ"}</p>
            <AdminPill tone={STATUS_TONE[repairJob.status] ?? "muted"}>{repairJobStatusLabel(repairJob.status)}</AdminPill>
          </div>
          <h2 className="mt-1.5 text-xl font-bold text-[var(--foreground)]">
            {date && repairJob.booking ? (
              <>
                {date.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                <span className="text-[var(--muted)]"> · </span>
                {repairJob.booking.booking_time.slice(0, 5)} น.
              </>
            ) : "ไม่พบวันที่นัด"}
          </h2>
        </div>
        {repairJob.booking ? (
          <Link className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-[var(--line)] bg-white px-3.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--color-concrete)]" href={`/admin/bookings/${repairJob.booking.id}`}>
            ดูรายละเอียดการจอง <AdminIcon name="chevron" className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <dl className="mx-6 mt-4 grid gap-5 border-t border-[var(--line)] pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <InfoBlock label="ลูกค้า">
          <p className="font-semibold">{repairJob.customer?.full_name ?? "-"}</p>
          {repairJob.customer?.phone_number ? (
            <a className="text-[var(--muted)] hover:text-[var(--color-safety)]" href={`tel:${repairJob.customer.phone_number}`}>{repairJob.customer.phone_number}</a>
          ) : null}
        </InfoBlock>
        <InfoBlock label="รถยนต์">
          <AdminPlate plate={repairJob.vehicle?.license_plate} />
          {vehicleName ? <p className="mt-1 text-[var(--muted)]">{vehicleName}</p> : null}
        </InfoBlock>
        <InfoBlock label="ช่างที่รับผิดชอบ">
          {repairJob.mechanic ? (
            <span className="flex items-center gap-2.5">
              <MechanicAvatar name={repairJob.mechanic.full_name} />
              <span className="min-w-0">
                <span className="block font-semibold">{repairJob.mechanic.full_name}</span>
                <span className="block truncate text-xs text-[var(--muted)]">{getMechanicSkillsLabel(repairJob.mechanic)}</span>
              </span>
            </span>
          ) : needsMechanic ? (
            <p className="font-semibold text-[var(--color-safety)]">ยังไม่มอบหมายช่าง</p>
          ) : <p className="text-[var(--muted)]">-</p>}
        </InfoBlock>
      </dl>

      {repairJob.diagnosis || repairJob.repair_notes ? (
        <div className="mx-6 mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-[var(--color-concrete-2)] px-4 py-3 text-sm">
            <p className="text-xs font-semibold text-[var(--muted)]">ผลการวินิจฉัย</p>
            <p className="mt-0.5 leading-6 text-[var(--color-steel)]">{repairJob.diagnosis || "-"}</p>
          </div>
          <div className="rounded-xl bg-[var(--color-concrete-2)] px-4 py-3 text-sm">
            <p className="text-xs font-semibold text-[var(--muted)]">บันทึกงานซ่อม</p>
            <p className="mt-0.5 leading-6 text-[var(--color-steel)]">{repairJob.repair_notes || "-"}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--line)] bg-[var(--color-concrete)] px-6 py-3.5">
        {needsMechanic ? (
          <button className={adminPrimaryButtonClass} onClick={onAssign} type="button">มอบหมายช่าง</button>
        ) : !closed ? (
          <button className={adminSecondaryButtonClass} onClick={onAssign} type="button">เปลี่ยนช่าง</button>
        ) : null}
        <p className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
          <AdminIcon name="clock" className="h-4 w-4" />
          {completed ? `เสร็จ ${completed}` : started ? `เริ่มงาน ${started}` : "ยังไม่เริ่มงาน"}
        </p>
      </div>
    </article>
  );
}

export function AdminRepairJobsPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", message: null, repairJobs: null });
  const [mechanics, setMechanics] = useState<AdminMechanic[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [assignTarget, setAssignTarget] = useState<AdminRepairJob | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadRepairJobs() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) return setLoadState({ status: "error", message: sessionError.message, repairJobs: null });
      if (!session?.user) return setLoadState({ status: "signed-out", message: null, repairJobs: null });

      const access = await checkAdminAccess(supabase, session.user.id);
      if (!isMounted) return;
      if (!access.allowed) return setLoadState({ status: "access-denied", message: access.reason, repairJobs: null });

      const [repairJobsResult, mechanicsResult] = await Promise.all([getAdminRepairJobs(supabase), getAdminMechanics(supabase)]);
      if (!isMounted) return;
      const error = repairJobsResult.error ?? mechanicsResult.error;
      if (error) return setLoadState({ status: "error", message: error.message, repairJobs: null });
      setMechanics(mechanicsResult.data ?? []);
      setLoadState({ status: "ready", message: null, repairJobs: repairJobsResult.data ?? [] });
    }

    void loadRepairJobs();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void loadRepairJobs(); });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const repairJobs = useMemo(() => (loadState.status === "ready" ? loadState.repairJobs : []), [loadState]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const repairJob of repairJobs) map.set(repairJob.status, (map.get(repairJob.status) ?? 0) + 1);
    return map;
  }, [repairJobs]);
  const openCount = repairJobs.filter((repairJob) => !isClosed(repairJob)).length;
  const unassignedOpen = repairJobs.filter((repairJob) => !repairJob.mechanic_id && !isClosed(repairJob)).length;

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return repairJobs
      .filter((repairJob) =>
        (statusFilter === "all" || (statusFilter === "open" ? !isClosed(repairJob) : repairJob.status === statusFilter)) &&
        (!keyword || [
          repairJob.service?.name,
          repairJob.customer?.full_name,
          repairJob.customer?.phone_number,
          repairJob.vehicle?.license_plate,
          repairJob.mechanic?.full_name,
        ].some((value) => (value ?? "").toLowerCase().includes(keyword))),
      )
      // งานที่ยังไม่เสร็จเรียงคิวที่ใกล้ที่สุดก่อน งานที่ปิดแล้วเรียงล่าสุดก่อน
      .sort((a, b) => {
        if (isClosed(a) !== isClosed(b)) return isClosed(a) ? 1 : -1;
        return isClosed(a) ? bookingSortKey(b).localeCompare(bookingSortKey(a)) : bookingSortKey(a).localeCompare(bookingSortKey(b));
      });
  }, [repairJobs, search, statusFilter]);

  async function handleAssign(mechanicId: string | null) {
    if (!assignTarget || loadState.status !== "ready") return;
    setSaving(true);
    const { data, error } = await updateAdminRepairJobMechanic(createClient(), assignTarget, mechanicId);
    setSaving(false);
    if (error) return setToast({ message: error.message, tone: "error" });
    setLoadState({ ...loadState, repairJobs: loadState.repairJobs.map((repairJob) => (repairJob.id === assignTarget.id && data ? data : repairJob)) });
    setAssignTarget(null);
    setToast({ message: mechanicId ? "มอบหมายช่างแล้ว" : "ยกเลิกการมอบหมายช่างแล้ว", tone: "success" });
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {loadState.status !== "ready" ? (
        <AdminLoadMessage loadingLabel="กำลังโหลดงานซ่อม..." message={loadState.message} status={loadState.status} />
      ) : (
        <>
          <AdminPageIntro description="งานซ่อมสร้างจากการจองที่ยืนยันแล้ว มอบหมายช่างเพื่อให้ช่างเห็นงานในหน้าใบงานของตัวเอง" />

          {unassignedOpen > 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-safety)]/30 bg-red-50/60 px-5 py-3.5 text-sm">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-safety)] font-bold text-white">{unassignedOpen}</span>
              <p className="text-[var(--foreground)]"><span className="font-semibold">งานที่ยังไม่มีช่าง</span> กดปุ่ม &quot;มอบหมายช่าง&quot; ในการ์ดที่มีกรอบสีแดง</p>
            </div>
          ) : null}

          <AdminFilterBar
            filter={statusFilter}
            filters={[
              { value: "open" as StatusFilter, label: "ยังไม่เสร็จ", count: openCount },
              ...statusOrder.map((status) => ({ value: status as StatusFilter, label: repairJobStatusLabel(status), count: counts.get(status) ?? 0 })),
              { value: "all" as StatusFilter, label: "ทั้งหมด", count: repairJobs.length },
            ]}
            onFilterChange={setStatusFilter}
            onSearchChange={setSearch}
            search={search}
            searchPlaceholder="ค้นหาทะเบียนรถ ลูกค้า บริการ หรือชื่อช่าง"
          />

          {filtered.length === 0 ? (
            <AdminEmptyState
              description={repairJobs.length === 0 ? "เมื่อยืนยันการจองแล้ว งานซ่อมจะแสดงที่นี่" : statusFilter === "open" && !search ? "ทุกงานเสร็จแล้ว" : "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"}
              title={repairJobs.length === 0 ? "ยังไม่มีงานซ่อม" : statusFilter === "open" && !search ? "ไม่มีงานที่ค้างอยู่" : "ไม่พบงานซ่อมที่ค้นหา"}
            />
          ) : (
            <div className="space-y-4">
              {filtered.map((repairJob) => (
                <RepairJobCard key={`${repairJob.id}-${repairJob.status}-${repairJob.mechanic_id ?? "none"}`} onAssign={() => setAssignTarget(repairJob)} repairJob={repairJob} />
              ))}
            </div>
          )}
        </>
      )}

      {assignTarget ? (
        <AssignMechanicModal key={assignTarget.id} mechanics={mechanics} onClose={() => setAssignTarget(null)} onSave={(mechanicId) => void handleAssign(mechanicId)} repairJob={assignTarget} saving={saving} />
      ) : null}

      <AdminToast message={toast?.message ?? null} onDone={clearToast} tone={toast?.tone} />
    </main>
  );
}
