"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getCustomerProductOrders,
  type ProductOrderWithItems,
} from "@/features/products";
import { createClient } from "@/lib/supabase/browser";
import { ProductImageThumb } from "./product-image-thumb";
import { SignInPrompt } from "@/components/sign-in-prompt";

type LoadState =
  | { status: "loading"; orders: null; error: null }
  | { status: "signed-out"; orders: null; error: null }
  | { status: "ready"; orders: ProductOrderWithItems[]; error: null }
  | { status: "error"; orders: null; error: string };

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function getOrderStatusStyle(status: ProductOrderWithItems["status"]) {
  if (status === "pending") {
    return "bg-amber-50 text-amber-800";
  }

  if (
    status === "confirmed" ||
    status === "preparing" ||
    status === "ready_for_pickup" ||
    status === "out_for_delivery"
  ) {
    return "bg-cyan-50 text-cyan-800";
  }

  if (status === "completed") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  return "bg-red-50 text-red-700";
}

function getPaymentStatusStyle(status: ProductOrderWithItems["payment_status"]) {
  if (status === "paid") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  if (status === "pending") {
    return "bg-amber-50 text-amber-800";
  }

  if (status === "refunded") {
    return "bg-cyan-50 text-cyan-800";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-700";
  }

  return "bg-[var(--color-concrete-2)] text-slate-700";
}

function getVerificationStatusStyle(
  status: ProductOrderWithItems["payments"][number]["verification_status"],
) {
  if (status === "verified") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  if (status === "submitted") {
    return "bg-amber-50 text-amber-800";
  }

  if (status === "rejected" || status === "failed") {
    return "bg-red-50 text-red-700";
  }

  return "bg-[var(--color-concrete-2)] text-slate-700";
}

function formatOrderStatus(status: ProductOrderWithItems["status"]) {
  if (status === "pending") {
    return "รอรับออเดอร์";
  }

  if (status === "confirmed") {
    return "ยืนยันออเดอร์แล้ว";
  }

  if (status === "preparing") {
    return "กำลังจัดเตรียม";
  }

  if (status === "ready_for_pickup") {
    return "พร้อมรับที่อู่";
  }

  if (status === "out_for_delivery") {
    return "กำลังจัดส่ง";
  }

  if (status === "completed") {
    return "สำเร็จ";
  }

  return "ยกเลิกแล้ว";
}

function formatPaymentStatus(status: ProductOrderWithItems["payment_status"]) {
  if (status === "paid") {
    return "ชำระเงินแล้ว";
  }

  if (status === "pending") {
    return "รอตรวจชำระเงิน";
  }

  if (status === "refunded") {
    return "คืนเงินแล้ว";
  }

  if (status === "cancelled") {
    return "ยกเลิกการชำระเงิน";
  }

  return "ยังไม่ชำระเงิน";
}

function formatVerificationStatus(
  status: ProductOrderWithItems["payments"][number]["verification_status"],
) {
  if (status === "not_submitted") {
    return "ยังไม่ส่งสลิป";
  }

  if (status === "submitted") {
    return "ส่งสลิปแล้ว รอตรวจ";
  }

  if (status === "verified") {
    return "สลิปผ่านแล้ว";
  }

  if (status === "rejected") {
    return "สลิปไม่ผ่าน";
  }

  return "ตรวจสลิปล้มเหลว";
}

function getPaymentVerifierLabel(
  payment: ProductOrderWithItems["payments"][number] | null,
) {
  if (!payment) {
    return "-";
  }

  if (payment.verification_provider === "slipok") {
    return "SlipOK";
  }

  return "แอดมิน";
}

function formatDeliveryMethod(method: ProductOrderWithItems["delivery_method"]) {
  return method === "delivery" ? "จัดส่งถึงบ้าน" : "รับที่อู่";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ProductOrderCard({ order }: { order: ProductOrderWithItems }) {
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const firstItems = order.items.slice(0, 3);
  const latestPayment = order.payments[0] ?? null;

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--brand)]">
            {order.order_number}
          </p>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {formatDateTime(order.created_at)}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {formatDeliveryMethod(order.delivery_method)} · {itemCount} รายการ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getOrderStatusStyle(
              order.status,
            )}`}
          >
            {formatOrderStatus(order.status)}
          </span>
          <span
            className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getPaymentStatusStyle(
              order.payment_status,
            )}`}
          >
            {formatPaymentStatus(order.payment_status)}
          </span>
          {latestPayment ? (
            <span
              className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getVerificationStatusStyle(
                latestPayment.verification_status,
              )}`}
            >
              {formatVerificationStatus(latestPayment.verification_status)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm sm:grid-cols-[minmax(0,1fr)_160px]">
        <div>
          <p className="font-semibold text-[var(--foreground)]">สินค้า</p>
          <div className="mt-2 space-y-2 text-[var(--muted)]">
            {firstItems.length > 0 ? (
              firstItems.map((item) => (
                <div className="flex items-center gap-3" key={item.id}>
                  <ProductImageThumb
                    alt={`รูปสินค้า ${item.product?.name ?? "สินค้า"}`}
                    size="sm"
                    src={item.product?.image_url}
                  />
                  <p>
                    {item.product?.name ?? "สินค้า"} x {item.quantity}
                  </p>
                </div>
              ))
            ) : (
              <p>ไม่มีรายการสินค้า</p>
            )}
            {order.items.length > firstItems.length ? (
              <p>และอีก {order.items.length - firstItems.length} รายการ</p>
            ) : null}
          </div>
        </div>
        <div>
          <p className="text-[var(--muted)]">ยอดรวม</p>
          <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {currencyFormatter.format(order.total_amount)}
          </p>
        </div>
      </div>

      {order.status === "cancelled" ? (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
          <p className="font-semibold">คำสั่งซื้อนี้ถูกยกเลิกแล้ว</p>
          <p className="mt-1">
            ออเดอร์นี้จะไม่ถูกจัดเตรียมหรือจัดส่งต่อแล้ว
          </p>
        </div>
      ) : null}

      {latestPayment?.verification_status === "rejected" ? (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
          <p className="font-semibold">สลิปไม่ผ่าน สามารถส่งใหม่ได้</p>
          <p className="mt-1">
            {latestPayment.rejected_reason
              ? `${getPaymentVerifierLabel(latestPayment)} ตรวจไม่ผ่าน: ${
                  latestPayment.rejected_reason
                }`
              : `${getPaymentVerifierLabel(
                  latestPayment,
                )} ตรวจไม่ผ่าน กรุณาเปิดรายละเอียดเพื่อส่งสลิปใหม่`}
          </p>
        </div>
      ) : null}

      {latestPayment?.verification_status === "submitted" ? (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
          <p className="font-semibold">ส่งสลิปแล้ว รอตรวจ</p>
          <p className="mt-1">
            {latestPayment.verification_provider === "slipok"
              ? "เมื่อ SlipOK หรือแอดมินตรวจผ่าน สถานะจะเปลี่ยนเป็นชำระเงินแล้ว"
              : "เมื่อแอดมินอนุมัติ สถานะจะเปลี่ยนเป็นชำระเงินแล้ว"}
          </p>
        </div>
      ) : null}

      {latestPayment?.verification_status === "verified" ? (
        <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-[var(--brand-strong)]">
          <p className="font-semibold">ชำระเงินเรียบร้อยแล้ว</p>
          <p className="mt-1">
            {getPaymentVerifierLabel(latestPayment)} ตรวจสลิปผ่านแล้ว
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="break-all text-xs text-[var(--muted)]">
          รหัสออเดอร์: {order.id}
        </p>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          href={`/my-product-orders/${order.id}`}
        >
          ดูรายละเอียด
        </Link>
      </div>
    </article>
  );
}

export function CustomerProductOrdersPanel() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadState, setLoadState] = useState<LoadState>({
    error: null,
    orders: null,
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadOrders() {
      setLoadState({
        error: null,
        orders: null,
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
          orders: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          error: null,
          orders: null,
          status: "signed-out",
        });
        return;
      }

      const { data, error } = await getCustomerProductOrders(
        supabase,
        session.user.id,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          error: error.message,
          orders: null,
          status: "error",
        });
        return;
      }

      setLoadState({
        error: null,
        orders: data ?? [],
        status: "ready",
      });
    }

    void loadOrders();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadOrders();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const orders = useMemo(() => (loadState.status === "ready" ? loadState.orders : []), [loadState]);
  const orderCounts = useMemo(() => ({
    all: orders.length,
    pending: orders.filter((order) => order.status === "pending").length,
    active: orders.filter((order) => ["confirmed", "preparing", "ready_for_pickup", "out_for_delivery"].includes(order.status)).length,
    completed: orders.filter((order) => order.status === "completed").length,
    cancelled: orders.filter((order) => order.status === "cancelled").length,
  }), [orders]);
  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "active" && ["confirmed", "preparing", "ready_for_pickup", "out_for_delivery"].includes(order.status))
        || order.status === statusFilter;
      const matchesQuery = !query || `${order.order_number} ${order.items.map((item) => item.product?.name ?? "").join(" ")}`.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [orders, searchTerm, statusFilter]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col bg-[#f7f7f8] px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red-50 text-2xl text-red-600" aria-hidden="true">🛍️</div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">คำสั่งซื้อของฉัน</h1>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">ติดตามสถานะ ตรวจสอบยอดชำระ และดูรายการสินค้าที่คุณสั่งซื้อ</p>
            </div>
          </div>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2" href="/products">
            + เลือกซื้อสินค้า
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดคำสั่งซื้อ...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <SignInPrompt title="ต้องเข้าสู่ระบบก่อนดูคำสั่งซื้อ" message="เข้าสู่ระบบด้วยบัญชีลูกค้าที่ใช้สั่งสินค้า" />
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="py-5">
          {loadState.orders.length > 0 ? (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { key: "all", label: "ทั้งหมด", count: orderCounts.all },
                  { key: "pending", label: "รอดำเนินการ", count: orderCounts.pending },
                  { key: "active", label: "กำลังดำเนินการ", count: orderCounts.active },
                  { key: "completed", label: "สำเร็จ", count: orderCounts.completed },
                  { key: "cancelled", label: "ยกเลิก", count: orderCounts.cancelled },
                ].map((item) => (
                  <button key={item.key} type="button" onClick={() => setStatusFilter(item.key)} className={`rounded-xl border p-3 text-left transition sm:p-4 ${statusFilter === item.key ? "border-red-500 bg-red-50 ring-1 ring-red-500" : "border-[var(--line)] bg-white hover:border-red-200"}`}>
                    <span className="block text-xs text-[var(--muted)] sm:text-sm">{item.label}</span>
                    <span className="mt-1 block text-xl font-bold text-[var(--foreground)]">{item.count}</span>
                  </button>
                ))}
              </div>
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <label className="relative block w-full sm:max-w-sm">
                  <span className="sr-only">ค้นหาคำสั่งซื้อ</span>
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--muted)]">⌕</span>
                  <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="ค้นหาเลขออเดอร์หรือชื่อสินค้า" className="min-h-11 w-full rounded-lg border border-[var(--line)] bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100" />
                </label>
                <p className="text-sm text-[var(--muted)]">แสดง {filteredOrders.length} จาก {orders.length} คำสั่งซื้อ</p>
              </div>
              {filteredOrders.length > 0 ? (
                <div className="space-y-4">{filteredOrders.map((order) => <ProductOrderCard key={order.id} order={order} />)}</div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">ไม่พบคำสั่งซื้อที่ตรงกับการค้นหา ลองเปลี่ยนคำค้นหาหรือเลือกสถานะอื่น</div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center shadow-sm">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-50 text-3xl" aria-hidden="true">🛒</div>
              <p className="mt-4 text-lg font-bold text-[var(--foreground)]">ยังไม่มีคำสั่งซื้อสินค้า</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">เมื่อคุณสั่งซื้อสินค้าแล้ว รายการคำสั่งซื้อและสถานะการจัดส่งจะแสดงที่หน้านี้</p>
              <Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700" href="/products">ไปเลือกสินค้า</Link>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
