"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/database.types";

type BookingPayment = Database["public"]["Tables"]["booking_payments"]["Row"];

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  style: "currency",
});

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "รอลูกค้าชำระ",
  not_required: "ยังไม่ต้องชำระ",
  paid: "ชำระแล้ว",
  pending_review: "รอตรวจสลิป",
  rejected: "สลิปไม่ผ่าน",
};

// ตรวจสลิปค่าซ่อมที่ลูกค้าส่งมา แล้วอนุมัติหรือปฏิเสธผ่านฟังก์ชันฐานข้อมูล
export function AdminRepairPaymentSection({
  bookingId,
  onChanged,
  paymentAmount,
  paymentStatus,
  pickedUpAt,
}: {
  bookingId: string;
  onChanged: () => void;
  paymentAmount: number | null;
  paymentStatus: string;
  pickedUpAt: string | null;
}) {
  const [payment, setPayment] = useState<BookingPayment | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    void (async () => {
      const result = await supabase
        .from("booking_payments")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isMounted || !result.data) return;
      setPayment(result.data);

      const signed = await supabase.storage
        .from("payment-slips")
        .createSignedUrl(result.data.slip_image_url, 60 * 30);
      if (isMounted) setSlipUrl(signed.data?.signedUrl ?? null);
    })();

    return () => {
      isMounted = false;
    };
  }, [bookingId, paymentStatus]);

  if (paymentStatus === "not_required") {
    return null;
  }

  const canReview = payment?.payment_status === "pending" && payment.verification_status === "submitted";

  async function handleApprove() {
    if (!payment) return;
    setIsWorking(true);
    setMessage(null);
    const { error } = await createClient().rpc("approve_booking_payment", {
      target_booking_payment_id: payment.id,
    });
    setIsWorking(false);

    if (error) {
      setMessage({ text: error.message, tone: "error" });
      return;
    }

    setMessage({ text: "อนุมัติการชำระค่าซ่อมแล้ว", tone: "success" });
    onChanged();
  }

  async function handleReject() {
    if (!payment) return;
    if (!reason.trim()) {
      setMessage({ text: "กรุณาระบุเหตุผลที่ปฏิเสธ", tone: "error" });
      return;
    }

    setIsWorking(true);
    setMessage(null);
    const { error } = await createClient().rpc("reject_booking_payment", {
      reason: reason.trim(),
      target_booking_payment_id: payment.id,
    });
    setIsWorking(false);

    if (error) {
      setMessage({ text: error.message, tone: "error" });
      return;
    }

    setIsRejecting(false);
    setReason("");
    setMessage({ text: "ปฏิเสธสลิปค่าซ่อมแล้ว", tone: "success" });
    onChanged();
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[var(--brand)]">ชำระค่าซ่อม</p>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-[var(--muted)]">สถานะ</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {PAYMENT_STATUS_LABEL[paymentStatus] ?? paymentStatus}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">ยอดค่าซ่อม</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {currencyFormatter.format(Number(paymentAmount ?? 0))}
          </dd>
        </div>
        {pickedUpAt ? (
          <div>
            <dt className="text-[var(--muted)]">ลูกค้ารับรถเมื่อ</dt>
            <dd className="mt-1 font-semibold text-[var(--foreground)]">
              {new Date(pickedUpAt).toLocaleString("th-TH")}
            </dd>
          </div>
        ) : null}
        {payment?.rejected_reason ? (
          <div>
            <dt className="text-[var(--muted)]">เหตุผลที่ปฏิเสธ</dt>
            <dd className="mt-1 text-[var(--foreground)]">{payment.rejected_reason}</dd>
          </div>
        ) : null}
      </dl>

      {slipUrl ? (
        <a
          className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-[var(--brand)] underline-offset-2 hover:underline"
          href={slipUrl}
          rel="noreferrer"
          target="_blank"
        >
          เปิดรูปสลิปค่าซ่อม
        </a>
      ) : null}

      {canReview ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={isWorking}
              onClick={handleApprove}
              type="button"
            >
              อนุมัติค่าซ่อม
            </button>
            <button
              className="min-h-10 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 disabled:opacity-60"
              disabled={isWorking}
              onClick={() => setIsRejecting((value) => !value)}
              type="button"
            >
              ปฏิเสธสลิป
            </button>
          </div>
          {isRejecting ? (
            <div className="space-y-2">
              <textarea
                className="min-h-20 w-full rounded-md border border-[var(--line)] p-3 text-sm"
                onChange={(event) => setReason(event.target.value)}
                placeholder="เช่น ยอดเงินไม่ตรง หรือรูปสลิปไม่ชัด"
                value={reason}
              />
              <button
                className="min-h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                disabled={isWorking}
                onClick={handleReject}
                type="button"
              >
                ยืนยันปฏิเสธสลิป
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            message.tone === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
          }`}
          role={message.tone === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
