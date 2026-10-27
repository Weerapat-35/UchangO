"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const CANCEL_REASONS = [
  "ต้องการเปลี่ยนที่อยู่จัดส่ง",
  "สั่งสินค้าผิด หรือต้องการแก้ไขรายการสินค้า",
  "เปลี่ยนใจ ไม่ต้องการสินค้านี้แล้ว",
  "อื่น ๆ",
] as const;

const OTHER_REASON = CANCEL_REASONS[CANCEL_REASONS.length - 1];

type CancelOrderDialogProps = {
  error?: string | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  open: boolean;
};

// หน้าต่างให้ลูกค้าเลือกเหตุผลก่อนยกเลิกคำสั่งซื้อ
export function CancelOrderDialog({
  error = null,
  isLoading = false,
  onClose,
  onConfirm,
  open,
}: CancelOrderDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [otherText, setOtherText] = useState("");
  const [wasOpen, setWasOpen] = useState(open);

  // ล้างเหตุผลที่เลือกไว้ทุกครั้งที่เปิดหน้าต่างใหม่
  if (open !== wasOpen) {
    setWasOpen(open);

    if (open) {
      setSelectedReason("");
      setOtherText("");
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const isOther = selectedReason === OTHER_REASON;
  const canConfirm = selectedReason !== "" && (!isOther || otherText.trim().length > 0);

  function handleConfirm() {
    if (!canConfirm) {
      return;
    }

    onConfirm(isOther ? `${OTHER_REASON}: ${otherText.trim()}` : selectedReason);
  }

  return createPortal(
    <div
      className="confirm-dialog-overlay fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-sm"
      onClick={isLoading ? undefined : onClose}
      role="presentation"
    >
      <div
        aria-labelledby="cancel-order-title"
        aria-modal="true"
        className="confirm-dialog-card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white px-6 pb-6 pt-7 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
          <svg
            aria-hidden="true"
            fill="none"
            height="26"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.2"
            viewBox="0 0 24 24"
            width="26"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m9 9 6 6M15 9l-6 6" />
          </svg>
        </div>

        <h2 className="mt-4 text-center text-lg font-bold text-[var(--foreground)]" id="cancel-order-title">
          ยกเลิกคำสั่งซื้อนี้ใช่ไหม
        </h2>
        <p className="mt-2 text-center text-sm leading-6 text-[var(--muted)]">
          กรุณาเลือกเหตุผลที่ยกเลิก สินค้าที่ตัดสต็อกไว้จะถูกคืนให้อัตโนมัติ และต้องสั่งซื้อใหม่หากยังต้องการสินค้า
        </p>

        <fieldset className="mt-5 grid gap-2">
          <legend className="sr-only">เหตุผลที่ยกเลิก</legend>
          {CANCEL_REASONS.map((reason) => {
            const selected = selectedReason === reason;

            return (
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                  selected
                    ? "border-[var(--brand)] bg-red-50/60 font-semibold text-[var(--foreground)]"
                    : "border-[var(--line)] text-[var(--foreground)] hover:border-slate-300"
                }`}
                key={reason}
              >
                <input
                  checked={selected}
                  disabled={isLoading}
                  name="cancel-reason"
                  onChange={() => setSelectedReason(reason)}
                  type="radio"
                />
                {reason}
              </label>
            );
          })}
        </fieldset>

        {isOther ? (
          <textarea
            aria-label="ระบุเหตุผลอื่น ๆ"
            className="mt-3 min-h-20 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            disabled={isLoading}
            maxLength={200}
            onChange={(event) => setOtherText(event.target.value)}
            placeholder="ระบุเหตุผล (ไม่เกิน 200 ตัวอักษร)"
            value={otherText}
          />
        ) : null}

        {error ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            className="min-h-10 flex-1 rounded-full bg-slate-100 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
            disabled={isLoading}
            onClick={onClose}
            type="button"
          >
            ไม่ยกเลิก
          </button>
          <button
            className="min-h-10 flex-1 rounded-full border border-red-200 bg-white px-5 text-sm font-semibold text-red-700 hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
            disabled={!canConfirm || isLoading}
            onClick={handleConfirm}
            type="button"
          >
            {isLoading ? "กำลังยกเลิก..." : "ยืนยันยกเลิกคำสั่งซื้อ"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
