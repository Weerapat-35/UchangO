"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  checkAdminAccess,
  getAdminBookingsPage,
  updateAdminBookingStatus,
  type AdminBooking,
  type AdminBookingListResult,
  type AdminBookingListStatusFilter,
  type AdminBookingStatusAction,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";
import { bookingStatusLabel } from "@/lib/status-labels";
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
  adminInputClass,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  type AdminPillTone,
} from "./admin-list-ui";

type StatusFilter = AdminBookingListStatusFilter;

type LoadState =
  | { status: "loading" | "signed-out"; message: null; result: null }
  | { status: "access-denied" | "error"; message: string; result: null }
  | { status: "ready"; message: null; result: AdminBookingListResult };

const pageSize = 10;
const editableStatuses: AdminBooking["status"][] = ["pending", "confirmed", "completed", "cancelled"];

// โทนสีตามเว็บ: รอยืนยัน = กรอบแดง (ต้องจัดการ) / ยืนยันแล้ว = ดำ / เสร็จ = เขียว / ยกเลิก = เทา
const STATUS_TONE: Record<string, AdminPillTone> = {
  pending: "attention",
  confirmed: "dark",
  completed: "done",
  cancelled: "muted",
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function parseStatusFilter(status: string | null): StatusFilter {
  return status === "pending" || status === "confirmed" || status === "cancelled" || status === "completed" ? status : "all";
}

function parsePage(page: string | null) {
  const parsedPage = Number(page);
  return Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;
}

function bookingDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

/** ปุ่มหลักที่ใช้บ่อยของแต่ละสถานะ */
function getPrimaryAction(status: AdminBooking["status"]): { label: string; status: AdminBookingStatusAction } | null {
  if (status === "pending") return { label: "ยืนยันการจอง", status: "confirmed" };
  if (status === "confirmed") return { label: "ปิดงาน (เสร็จแล้ว)", status: "completed" };
  return null;
}

function InfoBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-[var(--muted)]">{label}</dt>
      <dd className="mt-1.5 text-sm text-[var(--foreground)]">{children}</dd>
    </div>
  );
}

function BookingCard({
  booking,
  busy,
  onAction,
  onCancel,
  onEditStatus,
}: {
  booking: AdminBooking;
  busy: boolean;
  onAction: (status: AdminBookingStatusAction) => void;
  onCancel: () => void;
  onEditStatus: () => void;
}) {
  const date = bookingDate(booking.booking_date);
  const primary = getPrimaryAction(booking.status);
  const canCancel = booking.status === "pending" || booking.status === "confirmed";
  const isPending = booking.status === "pending";
  const vehicleName = booking.vehicle ? [booking.vehicle.brand, booking.vehicle.model, booking.vehicle.color].filter(Boolean).join(" ") : "";

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${isPending ? "border-[var(--color-safety)]/40" : "border-[var(--line)]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--color-safety)]">{booking.service?.name ?? "ไม่พบข้อมูลบริการ"}</p>
            <AdminPill tone={STATUS_TONE[booking.status] ?? "muted"}>{bookingStatusLabel(booking.status)}</AdminPill>
          </div>
          <h2 className={`mt-1.5 text-xl font-bold text-[var(--foreground)] ${booking.status === "cancelled" ? "text-[var(--muted)] line-through" : ""}`}>
            {date.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            <span className="text-[var(--muted)]"> · </span>
            {booking.booking_time.slice(0, 5)} น.
          </h2>
        </div>
        <Link className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-[var(--line)] bg-white px-3.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--color-concrete)]" href={`/admin/bookings/${booking.id}`}>
          ดูรายละเอียด <AdminIcon name="chevron" className="h-3.5 w-3.5" />
        </Link>
      </div>

      <dl className="mx-6 mt-4 grid gap-5 border-t border-[var(--line)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoBlock label="ลูกค้า">
          <p className="font-semibold">{booking.customer?.full_name ?? "-"}</p>
          {booking.customer?.phone_number ? (
            <a className="text-[var(--muted)] hover:text-[var(--color-safety)]" href={`tel:${booking.customer.phone_number}`}>{booking.customer.phone_number}</a>
          ) : null}
        </InfoBlock>
        <InfoBlock label="รถยนต์">
          <AdminPlate plate={booking.vehicle?.license_plate} />
          {vehicleName ? <p className="mt-1 text-[var(--muted)]">{vehicleName}</p> : null}
        </InfoBlock>
        <InfoBlock label="ราคาเริ่มต้น">
          <p className="text-base font-bold">{booking.service ? currencyFormatter.format(booking.service.base_price) : "-"}</p>
        </InfoBlock>
        <InfoBlock label="จองเมื่อ">
          <p>{new Date(booking.created_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</p>
        </InfoBlock>
      </dl>

      {booking.note ? (
        <div className="mx-6 mt-4 rounded-xl bg-[var(--color-concrete-2)] px-4 py-3 text-sm">
          <p className="text-xs font-semibold text-[var(--muted)]">หมายเหตุจากลูกค้า</p>
          <p className="mt-0.5 leading-6 text-[var(--color-steel)]">{booking.note}</p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[var(--color-concrete)] px-6 py-3.5">
        {primary ? (
          <button className={adminPrimaryButtonClass} disabled={busy} onClick={() => onAction(primary.status)} type="button">
            {busy ? "กำลังบันทึก..." : primary.label}
          </button>
        ) : (
          <p className="text-sm text-[var(--muted)]">{booking.status === "completed" ? "งานนี้เสร็จเรียบร้อยแล้ว" : "การจองนี้ถูกยกเลิกแล้ว"}</p>
        )}
        <button className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)] disabled:opacity-50" disabled={busy} onClick={onEditStatus} type="button">
          เปลี่ยนสถานะ
        </button>
        {canCancel ? (
          <button className="ml-auto min-h-11 rounded-xl px-4 text-sm font-semibold text-[var(--color-safety)] hover:bg-red-50 disabled:opacity-50" disabled={busy} onClick={onCancel} type="button">
            ยกเลิกการจอง
          </button>
        ) : null}
      </div>
    </article>
  );
}

function StatusEditor({ booking, busy, onClose, onSave }: { booking: AdminBooking; busy: boolean; onClose: () => void; onSave: (status: AdminBookingStatusAction) => void }) {
  const [selected, setSelected] = useState<AdminBookingStatusAction>(booking.status);
  return (
    <AdminModal
      description={`${booking.service?.name ?? "การจอง"} · ${booking.customer?.full_name ?? "-"} · ${bookingDate(booking.booking_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })} ${booking.booking_time.slice(0, 5)} น.`}
      footer={
        <>
          <button className={adminSecondaryButtonClass} onClick={onClose} type="button">ยกเลิก</button>
          <button className={adminPrimaryButtonClass} disabled={busy || selected === booking.status} onClick={() => onSave(selected)} type="button">
            {busy ? "กำลังบันทึก..." : "บันทึกสถานะ"}
          </button>
        </>
      }
      onClose={onClose}
      open
      title="เปลี่ยนสถานะการจอง"
    >
      <label className={adminLabelClass}>
        สถานะ
        <select className={adminInputClass} onChange={(event) => setSelected(event.target.value as AdminBookingStatusAction)} value={selected}>
          {editableStatuses.map((status) => <option key={status} value={status}>{bookingStatusLabel(status)}</option>)}
        </select>
      </label>
      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">ใช้เมื่อต้องการแก้สถานะที่กดผิด ปกติให้ใช้ปุ่มหลักในการ์ดแทน</p>
    </AdminModal>
  );
}

export function AdminBookingsPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = parseStatusFilter(searchParams.get("status"));
  const page = parsePage(searchParams.get("page"));
  const submittedSearch = searchParams.get("search") ?? "";
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", message: null, result: null });
  const [searchInput, setSearchInput] = useState(() => searchParams.get("search") ?? "");
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminBooking | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminBooking | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadBookings() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) return setLoadState({ status: "error", message: sessionError.message, result: null });
      if (!session?.user) return setLoadState({ status: "signed-out", message: null, result: null });

      const access = await checkAdminAccess(supabase, session.user.id);
      if (!isMounted) return;
      if (!access.allowed) return setLoadState({ status: "access-denied", message: access.reason, result: null });

      const { data, error } = await getAdminBookingsPage(supabase, { page, pageSize, search: submittedSearch, status: statusFilter });
      if (!isMounted) return;
      if (error) return setLoadState({ status: "error", message: error.message, result: null });
      setLoadState({ status: "ready", message: null, result: data });
    }

    void loadBookings();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void loadBookings(); });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [page, reloadKey, statusFilter, submittedSearch]);

  function updateFilters(next: { page?: number; search?: string; status?: StatusFilter }) {
    const params = new URLSearchParams();
    const nextStatus = next.status ?? statusFilter;
    const nextSearch = (next.search ?? submittedSearch).trim();
    const nextPage = next.page ?? page;
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextSearch) params.set("search", nextSearch);
    if (nextPage > 1) params.set("page", String(nextPage));
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilters({ page: 1, search: searchInput });
  }

  async function changeStatus(booking: AdminBooking, nextStatus: AdminBookingStatusAction) {
    setBusyId(booking.id);
    const { error } = await updateAdminBookingStatus(createClient(), booking.id, nextStatus);
    setBusyId(null);
    setCancelTarget(null);
    setStatusTarget(null);
    if (error) return setToast({ message: error.message, tone: "error" });
    setToast({ message: `เปลี่ยนเป็น "${bookingStatusLabel(nextStatus)}" แล้ว`, tone: "success" });
    setReloadKey((value) => value + 1);
  }

  const result = loadState.status === "ready" ? loadState.result : null;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {loadState.status !== "ready" || !result ? (
        <AdminLoadMessage loadingLabel="กำลังโหลดการจอง..." message={loadState.message} status={loadState.status === "ready" ? "loading" : loadState.status} />
      ) : (
        <>
          <AdminPageIntro description={`การจองทั้งหมด ${result.totalCount.toLocaleString("th-TH")} รายการ`} />

          <form onSubmit={handleSearchSubmit}>
            <AdminFilterBar
              filter={statusFilter}
              filters={(["all", ...editableStatuses] as StatusFilter[]).map((status) => ({ value: status, label: status === "all" ? "ทั้งหมด" : bookingStatusLabel(status) }))}
              onFilterChange={(status) => updateFilters({ page: 1, status })}
              onSearchChange={setSearchInput}
              search={searchInput}
              searchPlaceholder="ค้นหาชื่อลูกค้า เบอร์โทร ทะเบียนรถ หรือบริการ แล้วกด Enter"
              trailing={
                submittedSearch ? (
                  <button className={adminSecondaryButtonClass} onClick={() => { setSearchInput(""); updateFilters({ page: 1, search: "" }); }} type="button">ล้างคำค้นหา</button>
                ) : null
              }
            />
          </form>

          {result.bookings.length === 0 ? (
            <AdminEmptyState description={submittedSearch || statusFilter !== "all" ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "เมื่อลูกค้าจองคิว รายการจะแสดงที่นี่"} title="ไม่พบการจอง" />
          ) : (
            <div className="space-y-4">
              {result.bookings.map((booking) => (
                <BookingCard
                  booking={booking}
                  busy={busyId === booking.id}
                  key={`${booking.id}-${booking.status}`}
                  onAction={(status) => void changeStatus(booking, status)}
                  onCancel={() => setCancelTarget(booking)}
                  onEditStatus={() => setStatusTarget(booking)}
                />
              ))}
            </div>
          )}

          {result.totalPages > 1 ? (
            <nav aria-label="เปลี่ยนหน้า" className="flex items-center justify-between gap-3">
              <button className={adminSecondaryButtonClass} disabled={result.page <= 1} onClick={() => updateFilters({ page: result.page - 1 })} type="button">← ก่อนหน้า</button>
              <span className="text-sm text-[var(--muted)]">หน้า {result.page} จาก {result.totalPages}</span>
              <button className={adminSecondaryButtonClass} disabled={result.page >= result.totalPages} onClick={() => updateFilters({ page: result.page + 1 })} type="button">ถัดไป →</button>
            </nav>
          ) : null}
        </>
      )}

      {statusTarget ? (
        <StatusEditor booking={statusTarget} busy={busyId === statusTarget.id} key={statusTarget.id} onClose={() => setStatusTarget(null)} onSave={(status) => void changeStatus(statusTarget, status)} />
      ) : null}

      <ConfirmDialog
        cancelLabel="ไม่ยกเลิก"
        confirmLabel="ยกเลิกการจอง"
        description={cancelTarget ? `ยกเลิกการจอง "${cancelTarget.service?.name ?? "บริการ"}" ของ ${cancelTarget.customer?.full_name ?? "ลูกค้า"} วันที่ ${bookingDate(cancelTarget.booking_date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })} เวลา ${cancelTarget.booking_time.slice(0, 5)} น. ใช่ไหม? คิวนี้จะว่างให้ลูกค้าคนอื่นจองได้` : ""}
        isLoading={cancelTarget !== null && busyId === cancelTarget.id}
        loadingLabel="กำลังยกเลิก..."
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => { if (cancelTarget) void changeStatus(cancelTarget, "cancelled"); }}
        open={cancelTarget !== null}
        title="ยกเลิกการจองนี้?"
      />

      <AdminToast message={toast?.message ?? null} onDone={clearToast} tone={toast?.tone} />
    </main>
  );
}
