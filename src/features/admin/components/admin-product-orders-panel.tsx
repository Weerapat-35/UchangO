"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  checkAdminAccess,
  getAdminProductOrdersPage,
  updateAdminProductOrderStatus,
  type AdminProductOrder,
  type AdminProductOrderListPaymentFilter,
  type AdminProductOrderListResult,
  type AdminProductOrderListStatusFilter,
  type AdminProductOrderStatusAction,
} from "@/features/admin";
import { ProductImageThumb } from "@/features/products/components/product-image-thumb";
import { createClient } from "@/lib/supabase/browser";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminIcon,
  AdminLoadMessage,
  AdminModal,
  AdminPageIntro,
  AdminPill,
  AdminToast,
  adminInputClass,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  type AdminPillTone,
} from "./admin-list-ui";

type StatusFilter = AdminProductOrderListStatusFilter;
type PaymentFilter = AdminProductOrderListPaymentFilter;

type LoadState =
  | { status: "loading" | "signed-out"; message: null; result: null }
  | { status: "access-denied" | "error"; message: string; result: null }
  | { status: "ready"; message: null; result: AdminProductOrderListResult };

const pageSize = 10;
const orderStatuses: AdminProductOrderStatusAction[] = ["pending", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "completed", "cancelled"];
const paymentFilters: PaymentFilter[] = ["all", "unpaid", "pending", "paid", "refunded", "cancelled"];

// โทนสีตามเว็บ: รอรับออเดอร์ = กรอบแดง / ระหว่างดำเนินการ = ดำ / พร้อมส่งมอบ = แดงทึบ / สำเร็จ = เขียว / ยกเลิก = เทา
const ORDER_STATUS: Record<string, { label: string; tone: AdminPillTone }> = {
  pending: { label: "รอรับออเดอร์", tone: "attention" },
  confirmed: { label: "ยืนยันแล้ว", tone: "dark" },
  preparing: { label: "กำลังจัดเตรียม", tone: "dark" },
  ready_for_pickup: { label: "พร้อมรับที่อู่", tone: "brand" },
  out_for_delivery: { label: "กำลังจัดส่ง", tone: "brand" },
  completed: { label: "สำเร็จ", tone: "done" },
  cancelled: { label: "ยกเลิกแล้ว", tone: "muted" },
};

const PAYMENT_STATUS: Record<string, { label: string; tone: AdminPillTone }> = {
  unpaid: { label: "ยังไม่ชำระ", tone: "muted" },
  pending: { label: "รอตรวจสลิป", tone: "amber" },
  paid: { label: "ชำระแล้ว", tone: "done" },
  refunded: { label: "คืนเงินแล้ว", tone: "blue" },
  cancelled: { label: "ยกเลิกชำระเงิน", tone: "muted" },
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function parseStatusFilter(status: string | null): StatusFilter {
  return status && (orderStatuses as string[]).includes(status) ? (status as StatusFilter) : "all";
}

function parsePaymentFilter(paymentStatus: string | null): PaymentFilter {
  return paymentStatus && (paymentFilters as string[]).includes(paymentStatus) ? (paymentStatus as PaymentFilter) : "all";
}

function parsePage(page: string | null) {
  const parsedPage = Number(page);
  return Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** ปุ่มหลักของแต่ละสถานะ (ขั้นถัดไปของออเดอร์) */
function getPrimaryAction(order: AdminProductOrder): { label: string; status: AdminProductOrderStatusAction } | null {
  if (order.status === "pending") return { label: "ยืนยันออเดอร์", status: "confirmed" };
  if (order.status === "confirmed") return { label: "เริ่มจัดเตรียม", status: "preparing" };
  if (order.status === "preparing") {
    return order.delivery_method === "delivery" ? { label: "เริ่มจัดส่ง", status: "out_for_delivery" } : { label: "พร้อมให้รับที่อู่", status: "ready_for_pickup" };
  }
  if (order.status === "ready_for_pickup" || order.status === "out_for_delivery") return { label: "ปิดออเดอร์สำเร็จ", status: "completed" };
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

function OrderCard({
  busy,
  onAction,
  onCancel,
  onEditStatus,
  order,
}: {
  busy: boolean;
  onAction: (status: AdminProductOrderStatusAction) => void;
  onCancel: () => void;
  onEditStatus: () => void;
  order: AdminProductOrder;
}) {
  const status = ORDER_STATUS[order.status] ?? { label: order.status, tone: "muted" as AdminPillTone };
  const payment = PAYMENT_STATUS[order.payment_status] ?? { label: order.payment_status, tone: "muted" as AdminPillTone };
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const latestPayment = order.payments[0] ?? null;
  const primary = getPrimaryAction(order);
  const canCancel = order.status !== "completed" && order.status !== "cancelled";
  const needsAttention = order.status === "pending" || latestPayment?.verification_status === "submitted";
  const returnedCount = order.returnMovements.reduce((total, movement) => total + movement.quantity, 0);
  const soldCount = order.saleMovements.reduce((total, movement) => total + movement.quantity, 0);

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${needsAttention ? "border-[var(--color-safety)]/40" : "border-[var(--line)]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[var(--color-safety)]">#{order.order_number}</p>
            <AdminPill tone={status.tone}>{status.label}</AdminPill>
            <AdminPill tone={payment.tone}>{payment.label}</AdminPill>
          </div>
          <h2 className="mt-1.5 text-lg font-bold text-[var(--foreground)]">{formatDateTime(order.created_at)} น.</h2>
          <p className="text-sm text-[var(--muted)]">
            {order.delivery_method === "delivery" ? "จัดส่งถึงบ้าน" : "รับที่อู่"} · {itemCount} ชิ้น
          </p>
        </div>
        <Link className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-[var(--line)] bg-white px-3.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--color-concrete)]" href={`/admin/product-orders/${order.id}`}>
          ดูรายละเอียด <AdminIcon name="chevron" className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mx-6 mt-4 grid gap-5 border-t border-[var(--line)] pt-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <p className="text-xs font-semibold text-[var(--muted)]">สินค้าที่สั่ง</p>
          <ul className="mt-2 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
            {order.items.length === 0 ? <li className="px-3 py-3 text-sm text-[var(--muted)]">ไม่พบรายการสินค้า</li> : null}
            {order.items.map((item) => (
              <li className="flex items-center gap-3 px-3 py-2.5" key={item.id}>
                <ProductImageThumb alt={`รูปสินค้า ${item.product?.name ?? "สินค้า"}`} className="!h-11 !w-11 !rounded-lg" size="sm" src={item.product?.image_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">{item.product?.name ?? "สินค้าที่ถูกลบแล้ว"}</p>
                  <p className="text-xs text-[var(--muted)]">{currencyFormatter.format(item.unit_price)} × {item.quantity}</p>
                </div>
                <p className="whitespace-nowrap text-sm font-semibold text-[var(--foreground)]">{currencyFormatter.format(item.total_price)}</p>
              </li>
            ))}
          </ul>
        </div>

        <dl className="space-y-4">
          <InfoBlock label="ลูกค้า">
            <p className="font-semibold">{order.customer?.full_name ?? "-"}</p>
            {order.customer?.phone_number ? (
              <a className="text-[var(--muted)] hover:text-[var(--color-safety)]" href={`tel:${order.customer.phone_number}`}>{order.customer.phone_number}</a>
            ) : null}
          </InfoBlock>
          {order.delivery_method === "delivery" && order.delivery_address ? (
            <InfoBlock label="ที่อยู่จัดส่ง"><p className="line-clamp-2 text-[var(--color-steel)]">{order.delivery_address}</p></InfoBlock>
          ) : null}
          <div className="rounded-xl bg-[var(--color-concrete)] px-4 py-3 text-sm">
            <div className="flex justify-between text-[var(--muted)]"><span>ค่าสินค้า</span><span>{currencyFormatter.format(order.subtotal_amount)}</span></div>
            {order.delivery_fee > 0 ? <div className="mt-1 flex justify-between text-[var(--muted)]"><span>ค่าจัดส่ง</span><span>{currencyFormatter.format(order.delivery_fee)}</span></div> : null}
            <div className="mt-2 flex items-baseline justify-between border-t border-[var(--line)] pt-2">
              <span className="font-semibold text-[var(--foreground)]">ยอดรวม</span>
              <span className="text-xl font-bold text-[var(--foreground)]">{currencyFormatter.format(order.total_amount)}</span>
            </div>
          </div>
        </dl>
      </div>

      {order.note ? (
        <div className="mx-6 mt-4 rounded-xl bg-[var(--color-concrete-2)] px-4 py-3 text-sm">
          <p className="text-xs font-semibold text-[var(--muted)]">หมายเหตุจากลูกค้า</p>
          <p className="mt-0.5 leading-6 text-[var(--color-steel)]">{order.note}</p>
        </div>
      ) : null}

      {latestPayment?.verification_status === "submitted" ? (
        <div className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p><span className="font-semibold">ลูกค้าส่งสลิปแล้ว รอตรวจ</span> เปิดรายละเอียดเพื่อดูรูปสลิปและอนุมัติ</p>
          <Link className="whitespace-nowrap font-semibold underline-offset-2 hover:underline" href={`/admin/product-orders/${order.id}`}>ตรวจสลิป</Link>
        </div>
      ) : null}
      {latestPayment?.verification_status === "rejected" || latestPayment?.verification_status === "failed" ? (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">สลิปไม่ผ่าน</p>
          <p className="mt-0.5">{latestPayment.rejected_reason ?? "ยังไม่มีเหตุผลที่บันทึกไว้"}</p>
        </div>
      ) : null}
      {order.status === "cancelled" ? (
        <div className="mx-6 mt-4 rounded-xl bg-[var(--color-concrete-2)] px-4 py-3 text-sm text-[var(--muted)]">
          <p className="font-semibold text-[var(--foreground)]">ออเดอร์นี้ถูกยกเลิก{order.cancellation_reason ? `: ${order.cancellation_reason}` : ""}</p>
          <p className="mt-0.5">{soldCount > 0 ? `คืนสต็อกแล้ว ${returnedCount} จาก ${soldCount} ชิ้น` : "ไม่มีสต็อกที่ต้องคืน"}</p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[var(--color-concrete)] px-6 py-3.5">
        {primary ? (
          <button className={adminPrimaryButtonClass} disabled={busy} onClick={() => onAction(primary.status)} type="button">
            {busy ? "กำลังบันทึก..." : primary.label}
          </button>
        ) : (
          <p className="text-sm text-[var(--muted)]">{order.status === "completed" ? "ออเดอร์นี้สำเร็จแล้ว" : "ออเดอร์นี้ถูกยกเลิกแล้ว"}</p>
        )}
        <button className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)] disabled:opacity-50" disabled={busy} onClick={onEditStatus} type="button">เปลี่ยนสถานะ</button>
        {canCancel ? (
          <button className="ml-auto min-h-11 rounded-xl px-4 text-sm font-semibold text-[var(--color-safety)] hover:bg-red-50 disabled:opacity-50" disabled={busy} onClick={onCancel} type="button">ยกเลิกออเดอร์</button>
        ) : null}
      </div>
    </article>
  );
}

function StatusEditor({ busy, onClose, onSave, order }: { busy: boolean; onClose: () => void; onSave: (status: AdminProductOrderStatusAction) => void; order: AdminProductOrder }) {
  const [selected, setSelected] = useState<AdminProductOrderStatusAction>(order.status);
  return (
    <AdminModal
      description={`#${order.order_number} · ${order.customer?.full_name ?? "-"} · ${currencyFormatter.format(order.total_amount)}`}
      footer={
        <>
          <button className={adminSecondaryButtonClass} onClick={onClose} type="button">ยกเลิก</button>
          <button className={adminPrimaryButtonClass} disabled={busy || selected === order.status} onClick={() => onSave(selected)} type="button">
            {busy ? "กำลังบันทึก..." : "บันทึกสถานะ"}
          </button>
        </>
      }
      onClose={onClose}
      open
      title="เปลี่ยนสถานะออเดอร์"
    >
      <label className={adminLabelClass}>
        สถานะ
        <select className={adminInputClass} onChange={(event) => setSelected(event.target.value as AdminProductOrderStatusAction)} value={selected}>
          {orderStatuses.map((status) => <option key={status} value={status}>{ORDER_STATUS[status].label}</option>)}
        </select>
      </label>
      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">ใช้เมื่อต้องการแก้สถานะที่กดผิด ถ้าเปลี่ยนเป็น &quot;ยกเลิกแล้ว&quot; ระบบจะคืนสต็อกให้อัตโนมัติ</p>
    </AdminModal>
  );
}

export function AdminProductOrdersPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = parseStatusFilter(searchParams.get("status"));
  const paymentFilter = parsePaymentFilter(searchParams.get("payment"));
  const page = parsePage(searchParams.get("page"));
  const submittedSearch = searchParams.get("search") ?? "";
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", message: null, result: null });
  const [searchInput, setSearchInput] = useState(() => searchParams.get("search") ?? "");
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminProductOrder | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminProductOrder | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadOrders() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) return setLoadState({ status: "error", message: sessionError.message, result: null });
      if (!session?.user) return setLoadState({ status: "signed-out", message: null, result: null });

      const access = await checkAdminAccess(supabase, session.user.id);
      if (!isMounted) return;
      if (!access.allowed) return setLoadState({ status: "access-denied", message: access.reason, result: null });

      const { data, error } = await getAdminProductOrdersPage(supabase, { page, pageSize, paymentStatus: paymentFilter, search: submittedSearch, status: statusFilter });
      if (!isMounted) return;
      if (error) return setLoadState({ status: "error", message: error.message, result: null });
      setLoadState({ status: "ready", message: null, result: data });
    }

    void loadOrders();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void loadOrders(); });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [page, paymentFilter, reloadKey, statusFilter, submittedSearch]);

  function updateFilters(next: { page?: number; payment?: PaymentFilter; search?: string; status?: StatusFilter }) {
    const params = new URLSearchParams();
    const nextStatus = next.status ?? statusFilter;
    const nextPayment = next.payment ?? paymentFilter;
    const nextSearch = (next.search ?? submittedSearch).trim();
    const nextPage = next.page ?? page;
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextPayment !== "all") params.set("payment", nextPayment);
    if (nextSearch) params.set("search", nextSearch);
    if (nextPage > 1) params.set("page", String(nextPage));
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilters({ page: 1, search: searchInput });
  }

  async function changeStatus(order: AdminProductOrder, nextStatus: AdminProductOrderStatusAction) {
    setBusyId(order.id);
    const { error } = await updateAdminProductOrderStatus(createClient(), order.id, nextStatus);
    setBusyId(null);
    setCancelTarget(null);
    setStatusTarget(null);
    if (error) return setToast({ message: error.message, tone: "error" });
    setToast({ message: `#${order.order_number} เปลี่ยนเป็น "${ORDER_STATUS[nextStatus].label}" แล้ว`, tone: "success" });
    setReloadKey((value) => value + 1);
  }

  const result = loadState.status === "ready" ? loadState.result : null;
  const hasFilter = statusFilter !== "all" || paymentFilter !== "all" || submittedSearch;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {loadState.status !== "ready" || !result ? (
        <AdminLoadMessage loadingLabel="กำลังโหลดคำสั่งซื้อ..." message={loadState.message} status={loadState.status === "ready" ? "loading" : loadState.status} />
      ) : (
        <>
          <AdminPageIntro description={`คำสั่งซื้อสินค้าทั้งหมด ${result.totalCount.toLocaleString("th-TH")} รายการ เรียงจากล่าสุด กดปุ่มหลักในการ์ดเพื่อเลื่อนออเดอร์ไปขั้นถัดไป`} />

          <form onSubmit={handleSearchSubmit}>
            <AdminFilterBar
              filter={statusFilter}
              filters={(["all", ...orderStatuses] as StatusFilter[]).map((status) => ({ value: status, label: status === "all" ? "ทั้งหมด" : ORDER_STATUS[status].label }))}
              onFilterChange={(status) => updateFilters({ page: 1, status })}
              onSearchChange={setSearchInput}
              search={searchInput}
              searchPlaceholder="ค้นหาเลขออเดอร์ ชื่อลูกค้า หรือเบอร์โทร แล้วกด Enter"
              trailing={
                <select aria-label="กรองตามการชำระเงิน" className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--foreground)] lg:w-44" onChange={(event) => updateFilters({ page: 1, payment: event.target.value as PaymentFilter })} value={paymentFilter}>
                  {paymentFilters.map((value) => <option key={value} value={value}>{value === "all" ? "ทุกการชำระเงิน" : PAYMENT_STATUS[value].label}</option>)}
                </select>
              }
            />
          </form>
          {submittedSearch ? (
            <p className="text-sm text-[var(--muted)]">
              ผลการค้นหา &quot;{submittedSearch}&quot; ·{" "}
              <button className="font-semibold text-[var(--color-safety)] hover:underline" onClick={() => { setSearchInput(""); updateFilters({ page: 1, search: "" }); }} type="button">ล้างคำค้นหา</button>
            </p>
          ) : null}

          {result.orders.length === 0 ? (
            <AdminEmptyState description={hasFilter ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "เมื่อลูกค้าสั่งซื้อสินค้า รายการจะแสดงที่นี่"} title="ไม่พบคำสั่งซื้อ" />
          ) : (
            <div className="space-y-4">
              {result.orders.map((order) => (
                <OrderCard
                  busy={busyId === order.id}
                  key={`${order.id}-${order.status}-${order.payment_status}`}
                  onAction={(status) => void changeStatus(order, status)}
                  onCancel={() => setCancelTarget(order)}
                  onEditStatus={() => setStatusTarget(order)}
                  order={order}
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
        <StatusEditor busy={busyId === statusTarget.id} key={statusTarget.id} onClose={() => setStatusTarget(null)} onSave={(status) => void changeStatus(statusTarget, status)} order={statusTarget} />
      ) : null}

      <ConfirmDialog
        cancelLabel="ไม่ยกเลิก"
        confirmLabel="ยกเลิกออเดอร์"
        description={cancelTarget ? `ยกเลิกออเดอร์ #${cancelTarget.order_number} ของ ${cancelTarget.customer?.full_name ?? "ลูกค้า"} (${currencyFormatter.format(cancelTarget.total_amount)}) ใช่ไหม? สินค้าที่ตัดสต็อกไว้จะถูกคืนเข้าคลังอัตโนมัติ` : ""}
        isLoading={cancelTarget !== null && busyId === cancelTarget.id}
        loadingLabel="กำลังยกเลิก..."
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => { if (cancelTarget) void changeStatus(cancelTarget, "cancelled"); }}
        open={cancelTarget !== null}
        title="ยกเลิกออเดอร์นี้?"
      />

      <AdminToast message={toast?.message ?? null} onDone={clearToast} tone={toast?.tone} />
    </main>
  );
}
