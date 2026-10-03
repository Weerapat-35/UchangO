"use client";
import type { OrderStatus } from "@/components/order-status-stepper";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { OrderStatusStepper } from "@/components/order-status-stepper";
import {
  approveAdminProductPayment,
  checkAdminAccess,
  getAdminProductOrderById,
  rejectAdminProductPayment,
  updateAdminProductOrderStatus,
  type AdminAccessResult,
  type AdminProductOrder,
  type AdminProductOrderStatusAction,
} from "@/features/admin";
import { ProductImageThumb } from "@/features/products/components/product-image-thumb";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; access: null; order: null; error: null }
  | { status: "signed-out"; access: null; order: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      order: null;
      error: null;
    }
  | {
      status: "not-found";
      access: AdminAccessResult;
      order: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      order: AdminProductOrder;
      error: null;
    }
  | { status: "error"; access: null; order: null; error: string };

type ActionState =
  | { status: "idle"; error: null }
  | { status: "updating"; error: null }
  | { status: "error"; error: string };

type PaymentActionState =
  | { status: "idle"; error: null; message: null; paymentId: null }
  | { status: "updating"; error: null; message: null; paymentId: string }
  | { status: "success"; error: null; message: string; paymentId: string }
  | { status: "error"; error: string; message: null; paymentId: string | null };

type SlipOkVerifyResult = {
  failureKind?:
    | "amount_mismatch"
    | "duplicate_slip"
    | "provider_error"
    | "provider_unavailable"
    | "unauthorized_provider"
    | "unreadable_slip"
    | "verification_failed";
  ok?: boolean;
  message?: string;
  order?: {
    payment_status: AdminProductOrder["payment_status"];
  };
  payment?: AdminProductOrder["payments"][number];
};

function getSlipOkActionErrorMessage(result: SlipOkVerifyResult | null) {
  const baseMessage =
    result?.message ??
    "SlipOK ตรวจสลิปไม่ผ่าน หรือระบบตรวจสลิปยังไม่พร้อม";

  if (
    result?.failureKind === "provider_error" ||
    result?.failureKind === "provider_unavailable" ||
    result?.failureKind === "unauthorized_provider"
  ) {
    return `${baseMessage} สถานะ payment ยังไม่ถูกเปลี่ยน กรุณาตรวจการตั้งค่าหรือลองใหม่ภายหลัง`;
  }

  if (
    result?.failureKind === "amount_mismatch" ||
    result?.failureKind === "duplicate_slip" ||
    result?.failureKind === "unreadable_slip" ||
    result?.failureKind === "verification_failed"
  ) {
    return `${baseMessage} ระบบบันทึกเป็นสลิปไม่ผ่านแล้ว ลูกค้าสามารถส่งสลิปใหม่ได้`;
  }

  return baseMessage;
}

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function getAllowedStatusOptions(
  order: AdminProductOrder,
): AdminProductOrderStatusAction[] {
  if (order.status === "pending") return ["pending", "confirmed", "cancelled"];
  if (order.status === "confirmed") return ["confirmed", "preparing", "cancelled"];
  if (order.status === "preparing") {
    return order.delivery_method === "delivery"
      ? ["preparing", "out_for_delivery", "cancelled"]
      : ["preparing", "ready_for_pickup", "cancelled"];
  }
  if (order.status === "ready_for_pickup" || order.status === "out_for_delivery") {
    return [order.status, "completed"];
  }
  return [order.status];
}

function getOrderStatusStyle(status: AdminProductOrder["status"]) {
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

function getPaymentStatusStyle(status: AdminProductOrder["payment_status"]) {
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

  return "bg-slate-100 text-slate-700";
}

function getVerificationStatusStyle(
  status: AdminProductOrder["payments"][number]["verification_status"],
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

  return "bg-slate-100 text-slate-700";
}

function formatOrderStatus(status: AdminProductOrder["status"]) {
  if (status === "pending") {
    return "รอรับออเดอร์";
  }

  if (status === "confirmed") {
    return "ยืนยันแล้ว";
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

function formatPaymentStatus(
  status:
    | AdminProductOrder["payment_status"]
    | AdminProductOrder["payments"][number]["payment_status"],
) {
  if (status === "paid") {
    return "ชำระแล้ว";
  }

  if (status === "pending") {
    return "รอตรวจชำระเงิน";
  }

  if (status === "refunded") {
    return "คืนเงินแล้ว";
  }

  if (status === "cancelled") {
    return "ยกเลิกชำระเงิน";
  }

  if (status === "failed") {
    return "ชำระเงินไม่ผ่าน";
  }

  return "ยังไม่ชำระ";
}

function formatDeliveryMethod(method: AdminProductOrder["delivery_method"]) {
  return method === "delivery" ? "จัดส่งถึงบ้าน" : "รับที่อู่";
}

function formatPaymentMethod(
  method: AdminProductOrder["payments"][number]["payment_method"],
) {
  if (method === "promptpay") {
    return "PromptPay / QR";
  }

  if (method === "bank_transfer") {
    return "โอนเข้าบัญชีธนาคาร";
  }

  if (method === "cash") {
    return "จ่ายที่อู่";
  }

  if (method === "card") {
    return "บัตร";
  }

  return "อื่น ๆ";
}

function formatVerificationStatus(
  status: AdminProductOrder["payments"][number]["verification_status"],
) {
  if (status === "not_submitted") {
    return "ยังไม่ส่งสลิป";
  }

  if (status === "submitted") {
    return "ส่งสลิปแล้ว รอตรวจ";
  }

  if (status === "verified") {
    return "ตรวจสลิปผ่าน";
  }

  if (status === "rejected") {
    return "สลิปไม่ผ่าน";
  }

  return "ตรวจสลิปล้มเหลว";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getQuickActions(
  order: AdminProductOrder,
): Array<{
  label: string;
  status: AdminProductOrderStatusAction;
  tone: string;
}> {
  if (order.status === "pending") {
    return [
      {
        label: "ยืนยันออเดอร์",
        status: "confirmed",
        tone: "bg-[var(--brand)] text-white",
      },
      {
        label: "ยกเลิก",
        status: "cancelled",
        tone: "border border-red-200 bg-red-50 text-red-700",
      },
    ];
  }

  if (order.status === "confirmed") {
    return [
      {
        label: "เริ่มจัดเตรียม",
        status: "preparing",
        tone: "bg-[var(--brand)] text-white",
      },
      {
        label: "ยกเลิก",
        status: "cancelled",
        tone: "border border-red-200 bg-red-50 text-red-700",
      },
    ];
  }

  if (order.status === "preparing") {
    return [
      {
        label:
          order.delivery_method === "delivery"
            ? "เริ่มจัดส่ง"
            : "พร้อมรับที่อู่",
        status:
          order.delivery_method === "delivery"
            ? "out_for_delivery"
            : "ready_for_pickup",
        tone: "bg-[var(--brand)] text-white",
      },
      {
        label: "ยกเลิก",
        status: "cancelled",
        tone: "border border-red-200 bg-red-50 text-red-700",
      },
    ];
  }

  if (order.status === "ready_for_pickup" || order.status === "out_for_delivery") {
    return [
      {
        label: "ปิดออเดอร์สำเร็จ",
        status: "completed",
        tone: "bg-[var(--brand)] text-white",
      },
    ];
  }

  return [];
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 font-semibold text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function PaymentProofReview({
  onPaymentAction,
  order,
}: {
  onPaymentAction: (
    payment: AdminProductOrder["payments"][number],
    orderPaymentStatus: AdminProductOrder["payment_status"],
  ) => void;
  order: AdminProductOrder;
}) {
  const [signedSlipUrls, setSignedSlipUrls] = useState<Record<string, string>>(
    {},
  );
  const [signedUrlError, setSignedUrlError] = useState<string | null>(null);
  const [paymentActionState, setPaymentActionState] =
    useState<PaymentActionState>({
      error: null,
      message: null,
      paymentId: null,
      status: "idle",
    });
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");
  const hasSlipProof = order.payments.some((payment) => payment.slip_image_url);

  useEffect(() => {
    let isMounted = true;
    const paymentsWithSlip = order.payments.filter(
      (payment) => payment.slip_image_url,
    );

    if (paymentsWithSlip.length === 0) {
      return;
    }

    async function loadSignedSlipUrls() {
      const supabase = createClient();
      const nextUrls: Record<string, string> = {};

      for (const payment of paymentsWithSlip) {
        if (!payment.slip_image_url) {
          continue;
        }

        const { data, error } = await supabase.storage
          .from("payment-slips")
          .createSignedUrl(payment.slip_image_url, 60 * 30);

        if (error) {
          if (isMounted) {
            setSignedUrlError(error.message);
          }
          continue;
        }

        if (data?.signedUrl) {
          nextUrls[payment.id] = data.signedUrl;
        }
      }

      if (isMounted) {
        setSignedSlipUrls(nextUrls);
      }
    }

    loadSignedSlipUrls();

    return () => {
      isMounted = false;
    };
  }, [order.payments]);

  async function handleVerifyWithSlipOk(paymentId: string) {
    if (!window.confirm("ตรวจสลิปนี้ด้วย SlipOK ตอนนี้หรือไม่?")) {
      return;
    }

    setPaymentActionState({
      error: null,
      message: null,
      paymentId,
      status: "updating",
    });

    let response: Response;

    try {
      const supabase = createClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setPaymentActionState({
          error: sessionError?.message ?? "กรุณาเข้าสู่ระบบ admin อีกครั้ง",
          message: null,
          paymentId,
          status: "error",
        });
        return;
      }

      const accessToken = session.access_token;

      response = await fetch(
        `/api/product-payments/${paymentId}/verify-slipok`,
        {
          body: JSON.stringify({
            accessToken,
          }),
          credentials: "include",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
    } catch (error) {
      setPaymentActionState({
        error:
          error instanceof Error
            ? `เรียก SlipOK ไม่สำเร็จ: ${error.message}`
            : "เรียก SlipOK ไม่สำเร็จ",
        message: null,
        paymentId,
        status: "error",
      });
      return;
    }

    const result = (await response
      .json()
      .catch(() => null)) as SlipOkVerifyResult | null;

    if (result?.payment && result.order?.payment_status) {
      onPaymentAction(result.payment, result.order.payment_status);
      setRejectingPaymentId(null);
      setRejectReason("");
    }

    if (!response.ok || result?.ok !== true) {
      setPaymentActionState({
        error: getSlipOkActionErrorMessage(result),
        message: null,
        paymentId,
        status: "error",
      });
      return;
    }

    setPaymentActionState({
      error: null,
      message: result.message ?? "SlipOK ตรวจสลิปผ่านแล้ว",
      paymentId,
      status: "success",
    });
  }

  async function handleApprovePayment(paymentId: string) {
    if (!window.confirm("อนุมัติสลิปนี้เป็นชำระเงินแล้วหรือไม่?")) {
      return;
    }

    setPaymentActionState({
      error: null,
      message: null,
      paymentId,
      status: "updating",
    });

    const supabase = createClient();
    const { data, error } = await approveAdminProductPayment(
      supabase,
      paymentId,
    );

    if (error) {
      setPaymentActionState({
        error: error.message,
        message: null,
        paymentId,
        status: "error",
      });
      return;
    }

    onPaymentAction(data.payment, data.order.payment_status);
    setRejectingPaymentId(null);
    setRejectReason("");
    setPaymentActionState({
      error: null,
      message: "อนุมัติการชำระเงินแล้ว",
      paymentId,
      status: "success",
    });
  }

  async function handleRejectPayment(paymentId: string) {
    const normalizedReason = rejectReason.trim();

    if (normalizedReason.length === 0) {
      setPaymentActionState({
        error: "กรุณากรอกเหตุผลที่ปฏิเสธสลิป",
        message: null,
        paymentId,
        status: "error",
      });
      return;
    }

    setPaymentActionState({
      error: null,
      message: null,
      paymentId,
      status: "updating",
    });

    const supabase = createClient();
    const { data, error } = await rejectAdminProductPayment(
      supabase,
      paymentId,
      normalizedReason,
    );

    if (error) {
      setPaymentActionState({
        error: error.message,
        message: null,
        paymentId,
        status: "error",
      });
      return;
    }

    onPaymentAction(data.payment, data.order.payment_status);
    setRejectingPaymentId(null);
    setRejectReason("");
    setPaymentActionState({
      error: null,
      message: "ปฏิเสธสลิปแล้ว",
      paymentId,
      status: "success",
    });
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--brand)]">
            หลักฐานการชำระเงิน
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            ตรวจหลักฐาน แล้วอนุมัติหรือปฏิเสธการชำระเงินจากหน้านี้
          </p>
        </div>
        <span className="w-fit rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {order.payments.length} รายการ
        </span>
      </div>

      {hasSlipProof && signedUrlError ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
          เปิด signed slip link ไม่สำเร็จ: {signedUrlError}
        </div>
      ) : null}

      {paymentActionState.status === "success" ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-[var(--brand-strong)]">
          {paymentActionState.message}
        </div>
      ) : null}

      {paymentActionState.status === "error" ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
          {paymentActionState.error}
        </div>
      ) : null}

      {order.payments.length > 0 ? (
        <div className="mt-4 space-y-3">
          {order.payments.map((payment) => {
            const isUpdatingPayment =
              paymentActionState.status === "updating" &&
              paymentActionState.paymentId === payment.id;
            const canApprove =
              payment.payment_status === "pending" &&
              payment.verification_status === "submitted";
            const canVerifyWithSlipOk = canApprove;
            const canReject =
              payment.payment_status === "pending" &&
              payment.verification_status === "submitted";

            return (
              <div
                className="rounded-md border border-[var(--line)] bg-slate-50 p-4 text-sm"
                key={payment.id}
              >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-[var(--foreground)]">
                    {formatPaymentMethod(payment.payment_method)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    รหัสรายการชำระเงิน: {payment.id}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getVerificationStatusStyle(
                    payment.verification_status,
                  )}`}
                >
                  {formatVerificationStatus(payment.verification_status)}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailItem
                  label="ยอดที่ลูกค้าส่ง"
                  value={currencyFormatter.format(payment.amount)}
                />
                <DetailItem
                  label="สถานะ payment"
                  value={formatPaymentStatus(payment.payment_status)}
                />
                <DetailItem
                  label="เลขอ้างอิงสลิป"
                  value={payment.slip_reference ?? "-"}
                />
                <DetailItem
                  label="ส่งเมื่อ"
                  value={
                    payment.submitted_at
                      ? formatDateTime(payment.submitted_at)
                      : "-"
                  }
                />
                <DetailItem
                  label="ตรวจเมื่อ"
                  value={
                    payment.verified_at ? formatDateTime(payment.verified_at) : "-"
                  }
                />
                <DetailItem
                  label="เหตุผลที่ไม่ผ่าน"
                  value={payment.rejected_reason ?? "-"}
                />
              </dl>

              {payment.slip_image_url ? (
                <div className="mt-4 rounded-md bg-white p-3 text-xs leading-5 text-[var(--muted)]">
                  <p className="break-all">
                    ที่เก็บไฟล์: {payment.slip_image_url}
                  </p>
                  {signedSlipUrls[payment.id] ? (
                    <a
                      className="mt-3 inline-flex min-h-9 items-center rounded-md bg-[var(--brand)] px-3 text-sm font-semibold text-white"
                      href={signedSlipUrls[payment.id]}
                      rel="noreferrer"
                      target="_blank"
                    >
                      เปิดรูปสลิป
                    </a>
                  ) : (
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      กำลังเตรียมลิงก์รูปสลิป...
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 rounded-md bg-white p-3 text-xs text-[var(--muted)]">
                  ยังไม่มีรูปสลิปในรายการนี้
                </p>
              )}

                <div className="mt-4 rounded-md border border-[var(--line)] bg-white p-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="min-h-10 rounded-md border border-cyan-200 bg-cyan-50 px-4 text-sm font-semibold text-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!canVerifyWithSlipOk || isUpdatingPayment}
                      onClick={() => handleVerifyWithSlipOk(payment.id)}
                      type="button"
                    >
                      {isUpdatingPayment ? "กำลังตรวจ..." : "ตรวจด้วย SlipOK"}
                    </button>
                    <button
                      className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!canApprove || isUpdatingPayment}
                      onClick={() => handleApprovePayment(payment.id)}
                      type="button"
                    >
                      {isUpdatingPayment ? "กำลังบันทึก..." : "อนุมัติชำระเงิน"}
                    </button>
                    <button
                      className="min-h-10 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!canReject || isUpdatingPayment}
                      onClick={() => {
                        setRejectingPaymentId(payment.id);
                        setRejectReason(payment.rejected_reason ?? "");
                      }}
                      type="button"
                    >
                      ปฏิเสธสลิป
                    </button>
                  </div>

                  {!canApprove ? (
                    <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                      ปุ่มอนุมัติจะเปิดเฉพาะสลิปที่ลูกค้าส่งมาและยังรอตรวจอยู่
                    </p>
                  ) : null}

                  {rejectingPaymentId === payment.id ? (
                    <div className="mt-3 space-y-3">
                      <label className="block text-sm font-semibold text-[var(--foreground)]">
                        เหตุผลที่ปฏิเสธ
                        <textarea
                          className="mt-2 min-h-24 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                          disabled={isUpdatingPayment}
                          onChange={(event) =>
                            setRejectReason(event.target.value)
                          }
                          placeholder="เช่น ยอดเงินไม่ตรง หรือรูปสลิปไม่ชัด"
                          value={rejectReason}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                          disabled={isUpdatingPayment}
                          onClick={() => {
                            setRejectingPaymentId(null);
                            setRejectReason("");
                          }}
                          type="button"
                        >
                          ยกเลิกการปฏิเสธ
                        </button>
                        <button
                          className="min-h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isUpdatingPayment}
                          onClick={() => handleRejectPayment(payment.id)}
                          type="button"
                        >
                          ยืนยันปฏิเสธ
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]">
          ยังไม่มีหลักฐานการชำระเงินสำหรับคำสั่งซื้อนี้
        </div>
      )}
    </section>
  );
}

function StockReturnSummary({ order }: { order: AdminProductOrder }) {
  const soldItemCount = order.saleMovements.reduce(
    (total, movement) => total + movement.quantity,
    0,
  );
  const returnedItemCount = order.returnMovements.reduce(
    (total, movement) => total + movement.quantity,
    0,
  );
  const hasSaleMovements = order.saleMovements.length > 0;
  const isFullyReturned =
    hasSaleMovements && returnedItemCount >= soldItemCount;

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[var(--brand)]">
        คืนสต็อก
      </p>

      {order.status === "cancelled" ? (
        <div
          className={
            isFullyReturned || !hasSaleMovements
              ? "mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-[var(--brand-strong)]"
              : "mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800"
          }
        >
          <p className="font-semibold">
            {isFullyReturned
              ? "คืน stock แล้ว"
              : hasSaleMovements
                ? "ยังคืน stock ไม่ครบ"
                : "ไม่มี sale movement ที่ต้องคืน"}
          </p>
          <p className="mt-1">
            Return {returnedItemCount} / Sale {soldItemCount} ชิ้น
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-6 text-[var(--muted)]">
          ออเดอร์ยังไม่ถูกยกเลิก จึงยังไม่มีการคืน stock
        </div>
      )}

      {order.returnMovements.length > 0 ? (
        <div className="mt-4 space-y-3">
          {order.returnMovements.map((movement) => (
            <div
              className="rounded-md border border-[var(--line)] bg-slate-50 p-3 text-sm"
              key={movement.id}
            >
              <div className="flex gap-3">
                <ProductImageThumb
                  alt={`รูปสินค้า ${movement.product?.name ?? "สินค้า"}`}
                  size="sm"
                  src={movement.product?.image_url}
                />
                <div>
                  <p className="font-semibold text-[var(--foreground)]">
                    {movement.product?.name ?? "สินค้า"} +{movement.quantity}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {new Date(movement.created_at).toLocaleString("th-TH")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {movement.note ?? "-"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function AdminProductOrderDetailPanel({
  orderId,
}: {
  orderId: string;
}) {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    error: null,
    order: null,
    status: "loading",
  });
  const [actionState, setActionState] = useState<ActionState>({
    error: null,
    status: "idle",
  });
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] =
    useState<AdminProductOrderStatusAction>("pending");

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadOrder() {
      setLoadState({
        access: null,
        error: null,
        order: null,
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
          access: null,
          error: sessionError.message,
          order: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          error: null,
          order: null,
          status: "signed-out",
        });
        return;
      }

      const access = await checkAdminAccess(supabase, session.user.id);

      if (!isMounted) {
        return;
      }

      if (!access.allowed) {
        setLoadState({
          access,
          error: null,
          order: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminProductOrderById(
        supabase,
        orderId,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          error: error.message,
          order: null,
          status: "error",
        });
        return;
      }

      if (!data) {
        setLoadState({
          access,
          error: null,
          order: null,
          status: "not-found",
        });
        return;
      }

      setSelectedStatus(data.status);
      setLoadState({
        access,
        error: null,
        order: data,
        status: "ready",
      });
    }

    loadOrder();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadOrder();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [orderId]);

  async function handleStatusChange(nextStatus: AdminProductOrderStatusAction) {
    if (loadState.status !== "ready") {
      return;
    }

    if (
      nextStatus === "cancelled" &&
      !window.confirm(
        "ยกเลิกคำสั่งซื้อนี้และคืนสต็อกสินค้าเข้าคลังหรือไม่?",
      )
    ) {
      return;
    }

    setActionState({
      error: null,
      status: "updating",
    });

    const supabase = createClient();
    const { data, error } = await updateAdminProductOrderStatus(
      supabase,
      loadState.order.id,
      nextStatus,
    );

    if (error) {
      setActionState({
        error: error.message,
        status: "error",
      });
      return;
    }

    const refreshedOrderResult = await getAdminProductOrderById(
      supabase,
      loadState.order.id,
    );

    if (refreshedOrderResult.error) {
      setActionState({
        error: `Status updated, but refresh failed: ${refreshedOrderResult.error.message}`,
        status: "error",
      });
      return;
    }

    const nextOrder = refreshedOrderResult.data
      ? refreshedOrderResult.data
      : {
          ...loadState.order,
          status: data.status,
          updated_at: data.updated_at,
        };

    setSelectedStatus(nextOrder.status);
    setIsEditingStatus(false);
    setLoadState({
      ...loadState,
      order: nextOrder,
    });
    setActionState({
      error: null,
      status: "idle",
    });
  }

  function cancelEditStatus() {
    if (loadState.status === "ready") {
      setSelectedStatus(loadState.order.status);
    }

    setIsEditingStatus(false);
  }

  function handlePaymentAction(
    payment: AdminProductOrder["payments"][number],
    orderPaymentStatus: AdminProductOrder["payment_status"],
  ) {
    setLoadState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      const hasExistingPayment = current.order.payments.some(
        (item) => item.id === payment.id,
      );
      const nextPayments = hasExistingPayment
        ? current.order.payments.map((item) =>
            item.id === payment.id ? payment : item,
          )
        : [payment, ...current.order.payments];

      return {
        ...current,
        order: {
          ...current.order,
          payment_status: orderPaymentStatus,
          payments: nextPayments,
        },
      };
    });
  }

  const quickActions =
    loadState.status === "ready" ? getQuickActions(loadState.order) : [];
  const isUpdating = actionState.status === "updating";
  const canSaveStatus =
    loadState.status === "ready" &&
    selectedStatus !== loadState.order.status &&
    !isUpdating;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--brand)]"
            href="/admin/product-orders"
          >
            ← กลับไปออเดอร์สินค้า
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              รายละเอียดออเดอร์สินค้า
            </h1>
            {loadState.status === "ready" ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {loadState.order.order_number}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {loadState.status === "ready" && loadState.order.payment_status === "paid" ? (
            <Link
              className="min-h-10 rounded-xl bg-[var(--brand)] px-4 py-2 text-center text-sm font-bold text-white shadow-sm transition hover:opacity-90"
              href={`/invoice/${loadState.order.id}`}
            >
              🧾 ใบเสร็จ / PDF
            </Link>
          ) : null}
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-2xl border border-[var(--line)] bg-white px-6 py-5 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดรายละเอียดคำสั่งซื้อ...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-800 shadow-sm">
            <p className="font-bold">ต้องเข้าสู่ระบบก่อน</p>
            <p className="mt-1">เข้าสู่ระบบด้วยบัญชี admin</p>
            <Link className="mt-4 block min-h-10 rounded-xl bg-[var(--brand)] px-4 py-2 text-center text-sm font-bold text-white" href="/auth">
              ไปที่หน้าบัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "access-denied" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-sm leading-6 text-red-700 shadow-sm">
            <p className="text-lg font-bold">Access denied</p>
            <p className="mt-2">{loadState.access.reason}</p>
          </div>
        </section>
      ) : null}

      {loadState.status === "not-found" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-2xl border border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)] shadow-sm">
            <p className="font-bold text-[var(--foreground)]">ไม่พบคำสั่งซื้อสินค้า</p>
            <p className="mt-1">ออเดอร์นี้อาจไม่มีอยู่แล้ว</p>
            <Link className="mt-4 block min-h-10 rounded-xl bg-[var(--brand)] px-4 py-2 text-center text-sm font-bold text-white" href="/admin/product-orders">
              กลับไปออเดอร์สินค้า
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-2xl border border-red-200 bg-white px-6 py-5 text-sm text-red-700 shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <>
          <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand)]">สถานะออเดอร์</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">{loadState.order.order_number}</h2>
                  <span className="text-sm text-[var(--muted)]">สร้างเมื่อ {formatDateTime(loadState.order.created_at)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${getOrderStatusStyle(loadState.order.status)}`}>{formatOrderStatus(loadState.order.status)}</span>
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${getPaymentStatusStyle(loadState.order.payment_status)}`}>{formatPaymentStatus(loadState.order.payment_status)}</span>
              </div>
            </div>
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <OrderStatusStepper status={loadState.order.status as OrderStatus} />
            </div>
          </section>

          <section className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-6">
              <article className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--foreground)]">รายการสินค้า</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">ตรวจจำนวน ราคา และรายการที่ขายในออเดอร์นี้</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{loadState.order.items.length} รายการ</span>
                </div>
                <div className="mt-5 space-y-3">
                  {loadState.order.items.length > 0 ? loadState.order.items.map((item) => (
                    <div className="grid gap-4 rounded-xl border border-[var(--line)] bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_90px_140px] sm:items-center" key={item.id}>
                      <div className="flex min-w-0 items-center gap-4">
                        <ProductImageThumb alt={`รูปสินค้า ${item.product?.name ?? "สินค้า"}`} size="md" src={item.product?.image_url} />
                        <div className="min-w-0">
                          <p className="font-bold text-[var(--foreground)]">{item.product?.name ?? "สินค้า"}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">{item.product?.category?.name ?? "ไม่พบหมวดสินค้า"}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">SKU: {item.product?.sku ?? "-"}</p>
                        </div>
                      </div>
                      <div className="text-sm sm:text-center"><p className="text-xs text-[var(--muted)]">จำนวน</p><p className="mt-1 font-bold">{item.quantity}</p></div>
                      <div className="text-sm sm:text-right"><p className="text-xs text-[var(--muted)]">ราคารวม</p><p className="mt-1 font-bold">{currencyFormatter.format(item.total_price)}</p><p className="mt-1 text-xs text-[var(--muted)]">{currencyFormatter.format(item.unit_price)} / ชิ้น</p></div>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-[var(--line)] bg-slate-50 p-5 text-sm text-[var(--muted)]">ไม่พบรายการสินค้าในคำสั่งซื้อนี้</div>
                  )}
                </div>
                {loadState.order.note ? (
                  <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]"><p className="font-bold text-[var(--foreground)]">หมายเหตุ</p><p className="mt-1">{loadState.order.note}</p></div>
                ) : null}
              </article>

              <PaymentProofReview onPaymentAction={handlePaymentAction} order={loadState.order} />
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6">
              <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-bold text-[var(--foreground)]">ข้อมูลลูกค้า</h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">ลูกค้า</span>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <DetailItem label="ชื่อ" value={loadState.order.customer?.full_name ?? "-"} />
                  <DetailItem label="เบอร์โทร" value={loadState.order.customer?.phone_number ?? "-"} />
                  <DetailItem label="อีเมล" value={loadState.order.customer?.email ?? "-"} />
                </dl>
              </section>

              <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-bold text-[var(--foreground)]">จัดการสถานะ</h3>
                  {isUpdating ? <span className="text-xs font-semibold text-[var(--brand)]">กำลังบันทึก...</span> : null}
                </div>
                {isEditingStatus ? (
                  <div className="mt-4 rounded-xl border border-[var(--line)] bg-slate-50 p-3">
                    <label className="text-sm font-semibold text-[var(--foreground)]">
                      แก้ไขสถานะ
                      <select className="mt-2 min-h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]" disabled={isUpdating} onChange={(event) => setSelectedStatus(event.target.value as AdminProductOrderStatusAction)} value={selectedStatus}>
                        {getAllowedStatusOptions(loadState.order).map((status) => <option key={status} value={status}>{formatOrderStatus(status)}</option>)}
                      </select>
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="min-h-10 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]" disabled={isUpdating} onClick={cancelEditStatus} type="button">ยกเลิก</button>
                      <button className="min-h-10 rounded-xl bg-[var(--brand)] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={!canSaveStatus} onClick={() => handleStatusChange(selectedStatus)} type="button">บันทึกสถานะ</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {quickActions.length > 0 ? quickActions.map((action) => (
                      <button className={`min-h-10 w-full rounded-xl px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 ${action.tone}`} disabled={isUpdating} key={action.status} onClick={() => handleStatusChange(action.status)} type="button">
                        {action.label}
                      </button>
                    )) : <p className="text-sm font-semibold text-[var(--muted)]">ไม่มีปุ่มลัดสำหรับสถานะนี้</p>}
                    <button className="min-h-10 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]" disabled={isUpdating} onClick={() => setIsEditingStatus(true)} type="button">แก้ไขสถานะ</button>
                  </div>
                )}
                <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-[var(--brand-strong)]">การยกเลิกจะใช้ฟังก์ชันฐานข้อมูลที่คืนสต็อกอย่างปลอดภัยเมื่อมีรายการขายสินค้าเดิม</p>
                {actionState.status === "error" ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionState.error}</div> : null}
              </section>

              <StockReturnSummary order={loadState.order} />

              <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
                <h3 className="font-bold text-[var(--foreground)]">สรุปคำสั่งซื้อ</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <DetailItem label="วิธีรับสินค้า" value={formatDeliveryMethod(loadState.order.delivery_method)} />
                  <DetailItem label="สร้างเมื่อ" value={formatDateTime(loadState.order.created_at)} />
                  <DetailItem label="อัปเดตล่าสุด" value={formatDateTime(loadState.order.updated_at)} />
                  <div className="border-t border-[var(--line)] pt-4"><dt className="text-[var(--muted)]">ยอดสินค้า</dt><dd className="mt-1 font-semibold">{currencyFormatter.format(loadState.order.subtotal_amount)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">ค่าจัดส่ง</dt><dd className="font-semibold">{currencyFormatter.format(loadState.order.delivery_fee)}</dd></div>
                  <div className="border-t border-[var(--line)] pt-4"><dt className="font-bold">ยอดรวม</dt><dd className="mt-1 text-2xl font-black text-[var(--brand)]">{currencyFormatter.format(loadState.order.total_amount)}</dd></div>
                </dl>
              </section>

              {loadState.order.delivery_method === "delivery" ? (
                <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
                  <h3 className="font-bold text-[var(--foreground)]">ที่อยู่จัดส่ง</h3>
                  <p className="mt-3 rounded-xl bg-slate-50 p-4 whitespace-pre-line text-sm leading-6 text-[var(--foreground)]">{loadState.order.delivery_address ?? "-"}</p>
                </section>
              ) : null}
            </aside>
          </section>
        </>
      ) : null}
    </main>
  );
}
