"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  checkAdminAccess,
  createAdminGarageCapacity,
  getAdminGarageCapacity,
  updateAdminGarageCapacity,
  type AdminGarageCapacity,
  type AdminGarageCapacityInput,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";
import {
  AdminActiveSwitch,
  AdminDateHeading,
  AdminEmptyState,
  AdminFilterBar,
  AdminIcon,
  AdminLoadMessage,
  AdminModal,
  AdminPageIntro,
  AdminStatCard,
  AdminToast,
  adminDarkButtonClass,
  adminInputClass,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "./admin-list-ui";

type LoadState =
  | { status: "loading" | "signed-out"; message: null; capacity: null }
  | { status: "access-denied" | "error"; message: string; capacity: null }
  | { status: "ready"; message: null; capacity: AdminGarageCapacity[] };

type StatusFilter = "all" | "open" | "closed" | "full";
type EditorState = { mode: "create" } | { mode: "edit"; capacity: AdminGarageCapacity } | null;

const bookingStartTime = "09:00";
const bookingEndTime = "18:00";
const bookingSlotIntervalMinutes = 30;

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const bookingTimeOptions = Array.from(
  { length: Math.floor((timeToMinutes(bookingEndTime) - timeToMinutes(bookingStartTime)) / bookingSlotIntervalMinutes) + 1 },
  (_, index) => minutesToTime(timeToMinutes(bookingStartTime) + index * bookingSlotIntervalMinutes),
);

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function normalizeTime(time: string) {
  return time.slice(0, 5);
}

function getCapacityErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("garage_capacity_booking_slot_key")) return "วันและเวลานี้มีช่องคิวอยู่แล้ว";
  if (normalized.includes("garage_capacity_business_hours_check")) return "ช่องคิวต้องอยู่ระหว่าง 09:00 ถึง 18:00";
  if (normalized.includes("row-level security")) return "ระบบไม่อนุญาตให้แก้ไขคิว กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ";
  return message;
}

function toInput(capacity: AdminGarageCapacity, patch: Partial<AdminGarageCapacityInput> = {}): AdminGarageCapacityInput {
  return {
    booking_date: capacity.booking_date,
    booking_time: normalizeTime(capacity.booking_time),
    max_bookings: capacity.max_bookings,
    note: capacity.note,
    status: capacity.status,
    ...patch,
  };
}

/** แถบความจุ: จองแล้ว / สูงสุด */
function UsageBar({ capacity }: { capacity: AdminGarageCapacity }) {
  const ratio = capacity.max_bookings > 0 ? Math.min(1, capacity.activeBookingCount / capacity.max_bookings) : 1;
  const full = capacity.availableBookingCount <= 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-[var(--color-concrete-2)]">
        <div className={`h-full rounded-full ${full ? "bg-[var(--color-safety)]" : ratio >= 0.7 ? "bg-amber-500" : "bg-[var(--color-signal)]"}`} style={{ width: `${Math.max(ratio * 100, capacity.activeBookingCount > 0 ? 8 : 0)}%` }} />
      </div>
      <span className="whitespace-nowrap text-sm">
        <span className="font-bold text-[var(--foreground)]">{capacity.activeBookingCount}</span>
        <span className="text-[var(--muted)]"> / {capacity.max_bookings}</span>
      </span>
    </div>
  );
}

function CapacityEditor({
  editor,
  error,
  onClose,
  onSubmit,
  saving,
}: {
  editor: Exclude<EditorState, null>;
  error: string;
  onClose: () => void;
  onSubmit: (input: AdminGarageCapacityInput) => void;
  saving: boolean;
}) {
  const initial = editor.mode === "edit" ? editor.capacity : null;
  const [date, setDate] = useState(initial?.booking_date ?? todayString());
  const [time, setTime] = useState(initial ? normalizeTime(initial.booking_time) : "09:00");
  const [maxBookings, setMaxBookings] = useState(initial?.max_bookings ?? 3);
  const [open, setOpen] = useState((initial?.status ?? "open") === "open");
  const [note, setNote] = useState(initial?.note ?? "");
  const minimum = initial?.activeBookingCount ?? 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ booking_date: date, booking_time: time, max_bookings: maxBookings, note: note.trim() || null, status: open ? "open" : "closed" });
  }

  return (
    <AdminModal
      description={initial && initial.activeBookingCount > 0 ? `ช่องนี้มีการจองแล้ว ${initial.activeBookingCount} คิว ตั้งคิวสูงสุดต่ำกว่านี้ไม่ได้` : "กำหนดจำนวนลูกค้าที่รับได้ในช่วงเวลานี้"}
      footer={
        <>
          <button className={adminSecondaryButtonClass} onClick={onClose} type="button">ยกเลิก</button>
          <button className={adminPrimaryButtonClass} disabled={saving} form="capacity-editor" type="submit">
            {saving ? "กำลังบันทึก..." : initial ? "บันทึกการแก้ไข" : "เพิ่มช่องคิว"}
          </button>
        </>
      }
      onClose={onClose}
      open
      title={initial ? "แก้ไขช่องคิว" : "เพิ่มช่องคิวใหม่"}
    >
      <form className="space-y-4" id="capacity-editor" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={adminLabelClass}>
            วันที่
            <input className={adminInputClass} min={initial ? undefined : todayString()} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          </label>
          <label className={adminLabelClass}>
            เวลา
            <select className={adminInputClass} onChange={(event) => setTime(event.target.value)} value={time}>
              {bookingTimeOptions.map((option) => <option key={option} value={option}>{option} น.</option>)}
            </select>
          </label>
        </div>

        <div>
          <p className={adminLabelClass}>จำนวนคิวสูงสุด</p>
          <div className="mt-1.5 flex items-center gap-2">
            <button aria-label="ลดจำนวนคิว" className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)] bg-white text-lg font-bold hover:bg-[var(--color-concrete)]" onClick={() => setMaxBookings((value) => Math.max(minimum, value - 1))} type="button">−</button>
            <input
              aria-label="จำนวนคิวสูงสุด"
              className="min-h-11 w-24 rounded-xl border border-[var(--line)] bg-white px-3 text-center text-base font-semibold outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-red-100"
              inputMode="numeric"
              max={100}
              min={minimum}
              onChange={(event) => setMaxBookings(Math.min(100, Math.max(0, Math.floor(Number(event.target.value) || 0))))}
              type="number"
              value={maxBookings}
            />
            <button aria-label="เพิ่มจำนวนคิว" className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)] bg-white text-lg font-bold hover:bg-[var(--color-concrete)]" onClick={() => setMaxBookings((value) => Math.min(100, value + 1))} type="button">+</button>
            <span className="text-sm text-[var(--muted)]">คิว</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--color-concrete)] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">เปิดรับจอง</p>
            <p className="text-xs text-[var(--muted)]">ปิดไว้ถ้าไม่ต้องการให้ลูกค้าจองช่วงเวลานี้</p>
          </div>
          <AdminActiveSwitch active={open} label="เปิดรับจอง" onToggle={() => setOpen((value) => !value)} />
        </div>

        <label className={adminLabelClass}>
          หมายเหตุ <span className="font-normal text-[var(--muted)]">(ไม่บังคับ)</span>
          <input className={adminInputClass} onChange={(event) => setNote(event.target.value)} placeholder="เช่น ช่างลาครึ่งวัน" value={note} />
        </label>

        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      </form>
    </AdminModal>
  );
}

export function AdminCapacityPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", message: null, capacity: null });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [showPast, setShowPast] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadCapacity() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) return setLoadState({ status: "error", message: sessionError.message, capacity: null });
      if (!session?.user) return setLoadState({ status: "signed-out", message: null, capacity: null });

      const access = await checkAdminAccess(supabase, session.user.id);
      if (!isMounted) return;
      if (!access.allowed) return setLoadState({ status: "access-denied", message: access.reason, capacity: null });

      const { data, error } = await getAdminGarageCapacity(supabase);
      if (!isMounted) return;
      if (error) return setLoadState({ status: "error", message: getCapacityErrorMessage(error.message), capacity: null });
      setLoadState({ status: "ready", message: null, capacity: data ?? [] });
    }

    void loadCapacity();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void loadCapacity(); });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function reloadCapacity() {
    const { data, error } = await getAdminGarageCapacity(createClient());
    if (error) return setToast({ message: getCapacityErrorMessage(error.message), tone: "error" });
    setLoadState({ status: "ready", message: null, capacity: data ?? [] });
  }

  const today = todayString();
  const capacity = useMemo(() => (loadState.status === "ready" ? loadState.capacity : []), [loadState]);
  const upcoming = capacity.filter((slot) => slot.booking_date >= today);
  const pastCount = capacity.length - upcoming.length;
  const scope = showPast ? capacity : upcoming;
  const openCount = scope.filter((slot) => slot.status === "open").length;
  const fullCount = scope.filter((slot) => slot.status === "open" && slot.availableBookingCount <= 0).length;
  const bookedTotal = scope.reduce((total, slot) => total + slot.activeBookingCount, 0);

  const grouped = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const list = (showPast ? capacity : capacity.filter((slot) => slot.booking_date >= today)).filter((slot) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "full" ? slot.status === "open" && slot.availableBookingCount <= 0 : slot.status === filter);
      const matchesSearch = !keyword || (slot.note ?? "").toLowerCase().includes(keyword) || slot.booking_date.includes(keyword) || normalizeTime(slot.booking_time).includes(keyword);
      return matchesFilter && matchesSearch;
    });
    const groups = new Map<string, AdminGarageCapacity[]>();
    for (const slot of list) groups.set(slot.booking_date, [...(groups.get(slot.booking_date) ?? []), slot]);
    return [...groups.entries()];
  }, [capacity, filter, search, showPast, today]);

  function openEditor(next: EditorState) {
    setEditorError("");
    setEditor(next);
  }

  function findDuplicate(input: AdminGarageCapacityInput, ignoreId?: string) {
    return capacity.some((slot) => slot.id !== ignoreId && slot.booking_date === input.booking_date && normalizeTime(slot.booking_time) === input.booking_time);
  }

  async function handleSubmit(input: AdminGarageCapacityInput) {
    if (!editor) return;
    if (!input.booking_date) return setEditorError("กรุณาเลือกวันที่");
    if (!bookingTimeOptions.includes(input.booking_time)) return setEditorError("เวลาต้องอยู่ระหว่าง 09:00 ถึง 18:00 และแบ่งทุก 30 นาที");
    if (!Number.isInteger(input.max_bookings) || input.max_bookings < 0 || input.max_bookings > 100) return setEditorError("จำนวนคิวสูงสุดต้องเป็นจำนวนเต็ม 0–100");
    const editingId = editor.mode === "edit" ? editor.capacity.id : undefined;
    if (findDuplicate(input, editingId)) return setEditorError("วันและเวลานี้มีช่องคิวอยู่แล้ว ให้แก้ไขช่องเดิมแทน");
    if (editor.mode === "edit" && input.max_bookings < editor.capacity.activeBookingCount) {
      return setEditorError(`ช่องนี้มีการจองแล้ว ${editor.capacity.activeBookingCount} คิว ตั้งคิวสูงสุดต่ำกว่านี้ไม่ได้`);
    }

    setSaving(true);
    setEditorError("");
    const supabase = createClient();
    const { error } = editingId ? await updateAdminGarageCapacity(supabase, editingId, input) : await createAdminGarageCapacity(supabase, input);
    setSaving(false);
    if (error) return setEditorError(getCapacityErrorMessage(error.message));
    setEditor(null);
    setToast({ message: editingId ? "บันทึกช่องคิวแล้ว" : `เพิ่มช่องคิว ${input.booking_time} น. แล้ว`, tone: "success" });
    await reloadCapacity();
  }

  async function handleToggle(slot: AdminGarageCapacity) {
    setTogglingId(slot.id);
    const { error } = await updateAdminGarageCapacity(createClient(), slot.id, toInput(slot, { status: slot.status === "open" ? "closed" : "open" }));
    setTogglingId(null);
    if (error) return setToast({ message: getCapacityErrorMessage(error.message), tone: "error" });
    setToast({ message: `${slot.status === "open" ? "ปิด" : "เปิด"}รับจอง ${normalizeTime(slot.booking_time)} น. แล้ว`, tone: "success" });
    await reloadCapacity();
  }

  const addButton = (
    <button className={adminPrimaryButtonClass} onClick={() => openEditor({ mode: "create" })} type="button">
      <AdminIcon name="plus" /> เพิ่มช่องคิว
    </button>
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {loadState.status !== "ready" ? (
        <AdminLoadMessage loadingLabel="กำลังโหลดความจุคิว..." message={loadState.message} status={loadState.status} />
      ) : (
        <>
          <AdminPageIntro
            action={
              <>
                {addButton}
                <Link className={adminDarkButtonClass} href="/admin/schedule">ดูตารางคิว</Link>
                <Link className={adminSecondaryButtonClass} href="/admin/operating-days">วันเปิดร้าน</Link>
              </>
            }
            description="กำหนดจำนวนลูกค้าที่รับได้ในแต่ละช่วงเวลา และปิดรับจองบางช่วงได้ทันที"
          />

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <AdminStatCard highlight label={showPast ? "ช่องคิวทั้งหมด" : "ช่องคิวที่กำลังจะถึง"} value={scope.length} />
            <AdminStatCard label="เปิดรับจอง" value={openCount} />
            <AdminStatCard label="จองแล้ว (คิว)" value={bookedTotal} />
            <AdminStatCard label="ช่องที่เต็มแล้ว" value={fullCount} />
          </div>

          <AdminFilterBar
            filter={filter}
            filters={[
              { value: "all" as StatusFilter, label: "ทั้งหมด", count: scope.length },
              { value: "open" as StatusFilter, label: "เปิดรับ", count: openCount },
              { value: "full" as StatusFilter, label: "เต็มแล้ว", count: fullCount },
              { value: "closed" as StatusFilter, label: "ปิดรับ", count: scope.length - openCount },
            ]}
            onFilterChange={setFilter}
            onSearchChange={setSearch}
            search={search}
            searchPlaceholder="ค้นหาหมายเหตุ วันที่ (2026-10-30) หรือเวลา (09:30)"
            trailing={
              pastCount > 0 ? (
                <button className={`${adminSecondaryButtonClass} whitespace-nowrap`} onClick={() => setShowPast((value) => !value)} type="button">
                  {showPast ? "ซ่อนที่ผ่านมา" : `รวมที่ผ่านมา (${pastCount})`}
                </button>
              ) : null
            }
          />

          {grouped.length === 0 ? (
            <AdminEmptyState
              action={capacity.length === 0 ? addButton : undefined}
              description={capacity.length === 0 ? "เพิ่มช่องคิวเพื่อกำหนดจำนวนลูกค้าที่รับได้ในแต่ละเวลา" : "ลองเปลี่ยนตัวกรอง หรือกด \"รวมที่ผ่านมา\""}
              title={capacity.length === 0 ? "ยังไม่มีช่องคิว" : "ไม่พบช่องคิว"}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-[var(--color-asphalt)] text-xs font-semibold text-white">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold" scope="col">เวลา</th>
                      <th className="px-3 py-3.5 font-semibold" scope="col">จองแล้ว / สูงสุด</th>
                      <th className="px-3 py-3.5 text-right font-semibold" scope="col">ว่าง</th>
                      <th className="px-3 py-3.5 font-semibold" scope="col">รับจอง</th>
                      <th className="px-3 py-3.5 font-semibold" scope="col">หมายเหตุ</th>
                      <th className="px-5 py-3.5" scope="col"><span className="sr-only">แก้ไข</span></th>
                    </tr>
                  </thead>
                  {grouped.map(([date, slots]) => (
                    <tbody key={date}>
                      <tr className="border-t border-[var(--line)] bg-[var(--color-concrete)]">
                        <td className="px-5 py-2.5" colSpan={6}><AdminDateHeading count={slots.length} date={date} unit="ช่อง" /></td>
                      </tr>
                      {slots.map((slot) => {
                        const isOpen = slot.status === "open";
                        const full = isOpen && slot.availableBookingCount <= 0;
                        const past = slot.booking_date < today;
                        return (
                          <tr className={`border-t border-[var(--line)] transition hover:bg-[var(--color-concrete)] ${isOpen && !past ? "" : "text-[var(--muted)]"}`} key={slot.id}>
                            <td className="whitespace-nowrap px-5 py-3 text-base font-bold text-[var(--foreground)]">{normalizeTime(slot.booking_time)} <span className="text-xs font-normal text-[var(--muted)]">น.</span></td>
                            <td className="px-3 py-3"><UsageBar capacity={slot} /></td>
                            <td className={`whitespace-nowrap px-3 py-3 text-right font-bold ${full ? "text-[var(--color-safety)]" : "text-[var(--foreground)]"}`}>
                              {isOpen ? (full ? "เต็ม" : slot.availableBookingCount) : "–"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <span className="flex items-center gap-2.5">
                                <AdminActiveSwitch active={isOpen} disabled={togglingId === slot.id || past} label={`เปิด/ปิดรับจอง ${normalizeTime(slot.booking_time)}`} onToggle={() => void handleToggle(slot)} />
                                <span className={`text-xs font-semibold ${isOpen ? "text-[var(--color-signal)]" : "text-[var(--muted)]"}`}>{isOpen ? "เปิด" : "ปิด"}</span>
                              </span>
                            </td>
                            <td className="px-3 py-3 text-[var(--color-steel)]">{slot.note || <span className="text-[var(--muted)]">-</span>}</td>
                            <td className="px-5 py-3 text-right">
                              <button className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[var(--color-asphalt)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-asphalt-2)]" onClick={() => openEditor({ mode: "edit", capacity: slot })} type="button">
                                <AdminIcon name="edit" className="h-3.5 w-3.5" /> แก้ไข
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {editor ? (
        <CapacityEditor
          editor={editor}
          error={editorError}
          key={editor.mode === "edit" ? editor.capacity.id : "create"}
          onClose={() => setEditor(null)}
          onSubmit={(input) => void handleSubmit(input)}
          saving={saving}
        />
      ) : null}

      <AdminToast message={toast?.message ?? null} onDone={clearToast} tone={toast?.tone} />
    </main>
  );
}
