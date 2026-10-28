"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  checkAdminAccess,
  createAdminGarageClosedDate,
  deleteAdminGarageClosedDate,
  getAdminGarageOperatingSettings,
  updateAdminGarageOperatingDay,
  type AdminGarageClosedDate,
  type AdminGarageOperatingDay,
  type AdminGarageOperatingDayInput,
  type AdminGarageOperatingSettings,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";
import {
  AdminActiveSwitch,
  AdminIcon,
  AdminLoadMessage,
  AdminPageIntro,
  AdminToast,
  adminDarkButtonClass,
  adminInputClass,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "./admin-list-ui";

type LoadState =
  | { status: "loading" | "signed-out"; message: null; settings: null }
  | { status: "access-denied" | "error"; message: string; settings: null }
  | { status: "ready"; message: null; settings: AdminGarageOperatingSettings };

type DayDraft = AdminGarageOperatingDayInput;

const weekdayLabels = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
// เรียงจันทร์ → อาทิตย์ ตามที่ร้านใช้จริง
const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];

const timeInputClass =
  "min-h-10 w-[7.5rem] rounded-lg border border-transparent bg-transparent px-2 text-sm font-semibold text-[var(--foreground)] outline-none transition hover:border-[var(--line)] focus:border-[var(--brand)] focus:bg-white focus:ring-4 focus:ring-red-100";

function normalizeTime(time: string) {
  return time.slice(0, 5);
}

function toDraft(day: AdminGarageOperatingDay): DayDraft {
  return { close_time: normalizeTime(day.close_time), is_open: day.is_open, note: day.note ?? null, open_time: normalizeTime(day.open_time) };
}

function isSameDraft(a: DayDraft, b: DayDraft) {
  return a.is_open === b.is_open && a.open_time === b.open_time && a.close_time === b.close_time && (a.note ?? "") === (b.note ?? "");
}

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatClosedDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function getOperatingErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("garage_operating_days") || normalized.includes("garage_closed_dates")) {
    return "ยังไม่ได้รัน SQL ตั้งค่าวันเปิดร้าน กรุณารันไฟล์ supabase/garage-operating-days.sql ใน Supabase ก่อน";
  }
  if (normalized.includes("row-level security")) return "ระบบไม่อนุญาตให้แก้ไขข้อมูลนี้ กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ";
  if (normalized.includes("duplicate")) return "วันที่นี้ถูกเพิ่มเป็นวันหยุดพิเศษแล้ว";
  return message;
}

export function AdminOperatingDaysPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", message: null, settings: null });
  const [drafts, setDrafts] = useState<Record<number, DayDraft>>({});
  const [savingDays, setSavingDays] = useState(false);
  const [dayError, setDayError] = useState("");
  const [closedDate, setClosedDate] = useState(todayString());
  const [closedReason, setClosedReason] = useState("");
  const [addingClosed, setAddingClosed] = useState(false);
  const [closedError, setClosedError] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminGarageClosedDate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const applySettings = useCallback((settings: AdminGarageOperatingSettings) => {
    setLoadState({ status: "ready", message: null, settings });
    setDrafts(Object.fromEntries(settings.operatingDays.map((day) => [day.weekday, toDraft(day)])));
  }, []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadSettings() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) return setLoadState({ status: "error", message: sessionError.message, settings: null });
      if (!session?.user) return setLoadState({ status: "signed-out", message: null, settings: null });

      const access = await checkAdminAccess(supabase, session.user.id);
      if (!isMounted) return;
      if (!access.allowed) return setLoadState({ status: "access-denied", message: access.reason, settings: null });

      const { data, error } = await getAdminGarageOperatingSettings(supabase);
      if (!isMounted) return;
      if (error || !data) return setLoadState({ status: "error", message: getOperatingErrorMessage(error?.message ?? "โหลดข้อมูลไม่สำเร็จ"), settings: null });
      applySettings(data);
    }

    void loadSettings();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void loadSettings(); });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [applySettings]);

  async function reloadSettings() {
    const { data, error } = await getAdminGarageOperatingSettings(createClient());
    if (error || !data) return setToast({ message: getOperatingErrorMessage(error?.message ?? "โหลดข้อมูลไม่สำเร็จ"), tone: "error" });
    applySettings(data);
  }

  const operatingDays = useMemo(() => {
    const days = loadState.status === "ready" ? loadState.settings.operatingDays : [];
    return weekdayOrder.map((weekday) => days.find((day) => day.weekday === weekday)).filter((day): day is AdminGarageOperatingDay => Boolean(day));
  }, [loadState]);

  const changedDays = operatingDays.filter((day) => drafts[day.weekday] && !isSameDraft(drafts[day.weekday], toDraft(day)));
  const openCount = operatingDays.filter((day) => drafts[day.weekday]?.is_open).length;

  function updateDraft(weekday: number, patch: Partial<DayDraft>) {
    setDayError("");
    setDrafts((current) => ({ ...current, [weekday]: { ...current[weekday], ...patch } }));
  }

  async function saveDays() {
    for (const day of changedDays) {
      const draft = drafts[day.weekday];
      if (draft.is_open && (!draft.open_time || !draft.close_time)) return setDayError(`วัน${weekdayLabels[day.weekday]}: กรุณากำหนดเวลาเปิดและเวลาปิด`);
      if (draft.is_open && draft.open_time >= draft.close_time) return setDayError(`วัน${weekdayLabels[day.weekday]}: เวลาเปิดต้องมาก่อนเวลาปิด`);
    }

    setSavingDays(true);
    setDayError("");
    const supabase = createClient();
    for (const day of changedDays) {
      const draft = drafts[day.weekday];
      const { error } = await updateAdminGarageOperatingDay(supabase, day.weekday, { ...draft, note: draft.note?.trim() || null });
      if (error) {
        setSavingDays(false);
        return setDayError(`วัน${weekdayLabels[day.weekday]}: ${getOperatingErrorMessage(error.message)}`);
      }
    }
    setSavingDays(false);
    setToast({ message: `บันทึกเวลาเปิด-ปิด ${changedDays.length} วันแล้ว`, tone: "success" });
    await reloadSettings();
  }

  function resetDays() {
    setDayError("");
    setDrafts(Object.fromEntries(operatingDays.map((day) => [day.weekday, toDraft(day)])));
  }

  async function addClosedDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!closedDate) return setClosedError("กรุณาเลือกวันที่ปิด");
    setAddingClosed(true);
    setClosedError("");
    const { error } = await createAdminGarageClosedDate(createClient(), { closed_date: closedDate, reason: closedReason.trim() || null });
    setAddingClosed(false);
    if (error) return setClosedError(getOperatingErrorMessage(error.message));
    setClosedReason("");
    setToast({ message: `เพิ่มวันหยุด ${formatClosedDate(closedDate)} แล้ว`, tone: "success" });
    await reloadSettings();
  }

  async function handleDeleteClosedDate() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteAdminGarageClosedDate(createClient(), deleteTarget.closed_date);
    setDeleting(false);
    const target = deleteTarget;
    setDeleteTarget(null);
    if (error) return setToast({ message: getOperatingErrorMessage(error.message), tone: "error" });
    setToast({ message: `ลบวันหยุด ${formatClosedDate(target.closed_date)} แล้ว`, tone: "success" });
    await reloadSettings();
  }

  const today = todayString();
  const closedDates = loadState.status === "ready" ? loadState.settings.closedDates : [];
  const upcomingClosed = closedDates.filter((item) => item.closed_date >= today);
  const pastClosed = closedDates.filter((item) => item.closed_date < today).reverse();
  const visibleClosed = showPast ? [...upcomingClosed, ...pastClosed] : upcomingClosed;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 pb-28 sm:px-6 lg:px-8">
      {loadState.status !== "ready" ? (
        <AdminLoadMessage loadingLabel="กำลังโหลดวันเปิดร้าน..." message={loadState.message} status={loadState.status} />
      ) : (
        <>
          <AdminPageIntro
            action={
              <>
                <Link className={adminPrimaryButtonClass} href="/admin/schedule">ดูตารางคิว</Link>
                <Link className={adminDarkButtonClass} href="/admin/capacity">จัดการคิวรับงาน</Link>
              </>
            }
            description="กำหนดวันเปิด-ปิดประจำสัปดาห์ และเพิ่มวันหยุดพิเศษที่ไม่ต้องการให้ลูกค้าจองคิว"
          />

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-safety)]">วันเปิด-ปิดประจำสัปดาห์</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">วันที่ปิดจะไม่แสดงเวลาให้ลูกค้าเลือก และระบบจะไม่รับการจองในวันนั้น</p>
              </div>
              <p className="text-sm text-[var(--muted)]">เปิด <span className="font-bold text-[var(--foreground)]">{openCount}</span> วัน / สัปดาห์</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead className="bg-[var(--color-asphalt)] text-xs font-semibold text-white">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold" scope="col">วัน</th>
                      <th className="px-3 py-3.5 font-semibold" scope="col">เปิดร้าน</th>
                      <th className="px-3 py-3.5 font-semibold" scope="col">เวลาเปิด</th>
                      <th className="px-3 py-3.5 font-semibold" scope="col">เวลาปิด</th>
                      <th className="px-5 py-3.5 font-semibold" scope="col">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operatingDays.map((day) => {
                      const draft = drafts[day.weekday] ?? toDraft(day);
                      const changed = !isSameDraft(draft, toDraft(day));
                      const weekend = day.weekday === 0 || day.weekday === 6;
                      return (
                        <tr className={`border-t border-[var(--line)] transition ${changed ? "bg-amber-50/60" : draft.is_open ? "hover:bg-[var(--color-concrete)]" : "bg-[var(--color-concrete)]"}`} key={day.weekday}>
                          <td className="whitespace-nowrap px-5 py-2.5">
                            <span className={`font-bold ${draft.is_open ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{weekdayLabels[day.weekday]}</span>
                            {weekend ? <span className="ml-2 text-xs text-[var(--muted)]">สุดสัปดาห์</span> : null}
                            {changed ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">ยังไม่บันทึก</span> : null}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-2.5">
                              <AdminActiveSwitch active={draft.is_open} label={`เปิดร้านวัน${weekdayLabels[day.weekday]}`} onToggle={() => updateDraft(day.weekday, { is_open: !draft.is_open })} />
                              <span className={`text-xs font-semibold ${draft.is_open ? "text-[var(--color-signal)]" : "text-[var(--muted)]"}`}>{draft.is_open ? "เปิด" : "ปิดทั้งวัน"}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {draft.is_open ? (
                              <input aria-label={`เวลาเปิดวัน${weekdayLabels[day.weekday]}`} className={timeInputClass} onChange={(event) => updateDraft(day.weekday, { open_time: event.target.value })} type="time" value={draft.open_time} />
                            ) : <span className="px-2 text-[var(--muted)]">–</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {draft.is_open ? (
                              <input aria-label={`เวลาปิดวัน${weekdayLabels[day.weekday]}`} className={timeInputClass} onChange={(event) => updateDraft(day.weekday, { close_time: event.target.value })} type="time" value={draft.close_time} />
                            ) : <span className="px-2 text-[var(--muted)]">–</span>}
                          </td>
                          <td className="px-5 py-2.5">
                            <input
                              aria-label={`หมายเหตุวัน${weekdayLabels[day.weekday]}`}
                              className="min-h-10 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm text-[var(--color-steel)] outline-none transition placeholder:text-slate-300 hover:border-[var(--line)] focus:border-[var(--brand)] focus:bg-white focus:ring-4 focus:ring-red-100"
                              onChange={(event) => updateDraft(day.weekday, { note: event.target.value })}
                              placeholder={draft.is_open ? "เช่น ปิดเร็ววันเสาร์" : "เช่น ปิดทุกวันอาทิตย์"}
                              value={draft.note ?? ""}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-[var(--muted)]">กดที่เวลาหรือหมายเหตุเพื่อแก้ไขได้ทันที แล้วกด &quot;บันทึกการเปลี่ยนแปลง&quot; ด้านล่าง</p>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--foreground)]">วันหยุดพิเศษ</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">ใช้สำหรับวันที่ร้านปิดเฉพาะครั้ง เช่น วันหยุดยาว หรือวันที่ช่างไม่พร้อมรับงาน</p>

            <form className="mt-4 grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-end" onSubmit={addClosedDate}>
              <label className={adminLabelClass}>
                วันที่ปิดพิเศษ
                <input className={adminInputClass} min={today} onChange={(event) => setClosedDate(event.target.value)} type="date" value={closedDate} />
              </label>
              <label className={adminLabelClass}>
                เหตุผล <span className="font-normal text-[var(--muted)]">(ลูกค้าจะเห็น)</span>
                <input className={adminInputClass} onChange={(event) => setClosedReason(event.target.value)} placeholder="เช่น วันหยุดนักขัตฤกษ์" value={closedReason} />
              </label>
              <button className={adminPrimaryButtonClass} disabled={addingClosed} type="submit">
                <AdminIcon name="plus" /> {addingClosed ? "กำลังเพิ่ม..." : "เพิ่มวันหยุด"}
              </button>
            </form>
            {closedError ? <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{closedError}</p> : null}

            <div className="mt-5">
              {visibleClosed.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">ยังไม่มีวันหยุดพิเศษที่กำลังจะถึง</p>
              ) : (
                <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)]">
                  {visibleClosed.map((item) => {
                    const past = item.closed_date < today;
                    return (
                      <li className={`flex items-center gap-4 px-4 py-3 ${past ? "bg-[var(--color-concrete)] text-[var(--muted)]" : "bg-white"}`} key={item.closed_date}>
                        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-center leading-tight ${past ? "bg-[var(--color-concrete-2)]" : "bg-red-50 text-[var(--color-safety)]"}`}>
                          <span className="text-lg font-bold">{new Date(`${item.closed_date}T00:00:00`).getDate()}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block font-semibold ${past ? "" : "text-[var(--foreground)]"}`}>{formatClosedDate(item.closed_date)}</span>
                          <span className="block truncate text-sm text-[var(--muted)]">{item.reason || "ไม่ระบุเหตุผล"}{past ? " · ผ่านไปแล้ว" : ""}</span>
                        </span>
                        <button className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[var(--color-safety)] hover:bg-red-50" onClick={() => setDeleteTarget(item)} type="button">
                          <AdminIcon name="trash" /> ลบ
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {pastClosed.length > 0 ? (
                <button className="mt-3 text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setShowPast((value) => !value)} type="button">
                  {showPast ? "ซ่อนวันหยุดที่ผ่านมา" : `แสดงวันหยุดที่ผ่านมา (${pastClosed.length})`}
                </button>
              ) : null}
            </div>
          </section>
        </>
      )}

      {changedDays.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-[var(--line)] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:left-[264px]">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--foreground)]">
              แก้ไขแล้ว <span className="font-bold">{changedDays.length} วัน</span> ({changedDays.map((day) => weekdayLabels[day.weekday]).join(", ")})
              {dayError ? <span className="mt-1 block text-red-700">{dayError}</span> : null}
            </p>
            <div className="flex gap-2">
              <button className={adminSecondaryButtonClass} disabled={savingDays} onClick={resetDays} type="button">ยกเลิก</button>
              <button className={adminPrimaryButtonClass} disabled={savingDays} onClick={() => void saveDays()} type="button">{savingDays ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}</button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        description={deleteTarget ? `ลบวันหยุด ${formatClosedDate(deleteTarget.closed_date)}${deleteTarget.reason ? ` (${deleteTarget.reason})` : ""} ลูกค้าจะกลับมาจองคิววันนั้นได้ตามเวลาเปิดปกติ` : ""}
        isLoading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteClosedDate()}
        open={deleteTarget !== null}
        title="ลบวันหยุดพิเศษนี้?"
      />

      <AdminToast message={toast?.message ?? null} onDone={clearToast} tone={toast?.tone} />
    </main>
  );
}
