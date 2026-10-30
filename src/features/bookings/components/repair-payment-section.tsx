"use client";

import { useEffect, useState } from "react";
import {
  confirmBookingPickup,
  getLatestBookingPayment,
  submitBookingPaymentSlip,
  type BookingPayment,
  type MyBooking,
} from "@/features/bookings";
import { getActivePaymentSetting } from "@/features/products";
import { createClient } from "@/lib/supabase/browser";
import { currencyFormatter, formatDateTimeThai } from "./booking-ui";

type PaymentSetting = Awaited<ReturnType<typeof getActivePaymentSetting>>["data"];

type ActionState =
  | { status: "idle"; message: null }
  | { status: "working"; message: null }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const PAYMENT_STATUS_LABEL: Record<string, { label: string; style: string }> = {
  awaiting_payment: { label: "รอชำระค่าซ่อม", style: "bg-amber-50 text-amber-800 ring-amber-200" },
  pending_review: { label: "ส่งสลิปแล้ว รอตรวจ", style: "bg-cyan-50 text-cyan-800 ring-cyan-200" },
  paid: { label: "ชำระแล้ว", style: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  rejected: { label: "สลิปไม่ผ่าน", style: "bg-red-50 text-red-700 ring-red-200" },
};

export function RepairPaymentSection({
  booking,
  onChanged,
  userId,
}: {
  booking: MyBooking;
  onChanged: () => void;
  userId: string;
}) {
  const [payment, setPayment] = useState<BookingPayment | null>(null);
  const [setting, setSetting] = useState<PaymentSetting>(null);
  const [file, setFile] = useState<File | null>(null);
  const [action, setAction] = useState<ActionState>({ message: null, status: "idle" });

  const paymentStatus = booking.payment_status;

  useEffect(() => {
    if (paymentStatus === "not_required") {
      return;
    }

    let isMounted = true;
    const supabase = createClient();

    void Promise.all([
      getLatestBookingPayment(supabase, booking.id),
      getActivePaymentSetting(supabase),
    ]).then(([paymentResult, settingResult]) => {
      if (!isMounted) return;
      setPayment(paymentResult.data);
      setSetting(settingResult.data);
    });

    return () => {
      isMounted = false;
    };
  }, [booking.id, paymentStatus]);

  if (paymentStatus === "not_required") {
    return null;
  }

  const meta = PAYMENT_STATUS_LABEL[paymentStatus] ?? PAYMENT_STATUS_LABEL.awaiting_payment;
  const canUpload = paymentStatus === "awaiting_payment" || paymentStatus === "rejected";
  const canPickUp = paymentStatus === "paid" && !booking.picked_up_at;
  const isWorking = action.status === "working";

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setAction({ message: "กรุณาแนบรูปสลิป", status: "error" });
      return;
    }

    setAction({ message: null, status: "working" });
    const { error } = await submitBookingPaymentSlip(createClient(), userId, booking.id, file);

    if (error) {
      setAction({ message: error.message, status: "error" });
      return;
    }

    setFile(null);
    setAction({ message: "ระบบบันทึกสลิปแล้ว กรุณารอแอดมินตรวจและอนุมัติ", status: "success" });
    onChanged();
  }

  async function handlePickup() {
    setAction({ message: null, status: "working" });
    const { error } = await confirmBookingPickup(createClient(), booking.id);

    if (error) {
      setAction({ message: error.message, status: "error" });
      return;
    }

    setAction({ message: "ยืนยันรับรถเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ", status: "success" });
    onChanged();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
        <h2 className="text-base font-extrabold text-[var(--foreground)] sm:text-lg">ชำระค่าซ่อม</h2>
        <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ring-1 ring-inset ${meta.style}`}>
          {meta.label}
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3 rounded-xl bg-[var(--color-concrete-2)] p-4">
          <p className="text-sm font-bold text-[var(--foreground)]">ยอดที่ต้องชำระ</p>
          <p className="text-2xl font-extrabold text-[var(--foreground)]">
            {currencyFormatter.format(Number(booking.payment_amount ?? 0))}
          </p>
        </div>

        {paymentStatus === "rejected" && payment?.rejected_reason ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            สลิปไม่ผ่าน: {payment.rejected_reason} กรุณาส่งสลิปใหม่
          </div>
        ) : null}

        {canUpload ? (
          <form className="space-y-3" noValidate onSubmit={handleUpload}>
            {setting?.promptpay_enabled ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                โอนผ่านพร้อมเพย์ <span className="font-bold text-[var(--foreground)]">{setting.promptpay_id}</span>
                {" "}({setting.promptpay_display_name}) แล้วแนบสลิป
              </p>
            ) : null}
            {setting?.bank_transfer_enabled ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                หรือโอนเข้า {setting.bank_name} เลขบัญชี{" "}
                <span className="font-bold text-[var(--foreground)]">{setting.bank_account_number}</span>
                {setting.bank_account_name ? ` (${setting.bank_account_name})` : ""}
              </p>
            ) : null}
            <label className="block text-sm font-semibold text-[var(--foreground)]">
              รูปสลิปค่าซ่อม
              <input
                accept="image/jpeg,image/png,image/webp"
                className="mt-2 block w-full text-sm"
                disabled={isWorking}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isWorking}
              type="submit"
            >
              {isWorking ? "กำลังส่งสลิป..." : "ส่งสลิปค่าซ่อม"}
            </button>
          </form>
        ) : null}

        {paymentStatus === "pending_review" ? (
          <p className="text-sm leading-6 text-[var(--muted)]">
            ส่งสลิปแล้ว{payment?.submitted_at ? `เมื่อ ${formatDateTimeThai(payment.submitted_at)}` : ""} รอแอดมินตรวจและอนุมัติ
          </p>
        ) : null}

        {canPickUp ? (
          <div className="space-y-2">
            <p className="text-sm leading-6 text-[var(--muted)]">ชำระเงินเรียบร้อยแล้ว เมื่อรับรถคืนแล้วกดยืนยันด้านล่าง</p>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isWorking}
              onClick={handlePickup}
              type="button"
            >
              {isWorking ? "กำลังบันทึก..." : "ยืนยันรับรถ"}
            </button>
          </div>
        ) : null}

        {booking.picked_up_at ? (
          <p className="text-sm font-bold text-emerald-700">รับรถแล้วเมื่อ {formatDateTimeThai(booking.picked_up_at)}</p>
        ) : null}

        {action.status === "error" ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {action.message}
          </div>
        ) : null}
        {action.status === "success" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
            {action.message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
