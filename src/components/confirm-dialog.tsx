"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

type ConfirmDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  isLoading?: boolean;
  /** ข้อความบนปุ่มระหว่างรอ (ค่าเริ่มต้น "กำลังลบ...") */
  loadingLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
  /** danger = ลบ/ทำลายข้อมูล (ไอคอนถังขยะสีแดง), primary = ยืนยันการทำงานทั่วไป (ไอคอนถูกต้อง) */
  variant?: "danger" | "primary";
};

export function ConfirmDialog({
  cancelLabel = "เก็บไว้ก่อน",
  confirmLabel = "ยืนยันการลบ",
  description,
  isLoading = false,
  loadingLabel = "กำลังลบ...",
  onCancel,
  onConfirm,
  open,
  title,
  variant = "danger",
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="confirm-dialog-overlay fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <div
        aria-describedby="confirm-dialog-description"
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        className="confirm-dialog-card max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white px-6 pb-6 pt-7 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            variant === "danger" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {variant === "danger" ? (
            <svg
              aria-hidden="true"
              fill="none"
              height="24"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="24"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          ) : (
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
              <path d="m8 12.5 3 3 5-6" />
            </svg>
          )}
        </div>

        <h2
          className="mt-4 text-lg font-bold text-[var(--foreground)]"
          id="confirm-dialog-title"
        >
          {title}
        </h2>
        <p
          className="mt-2 text-sm leading-6 text-[var(--muted)]"
          id="confirm-dialog-description"
        >
          {description}
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            autoFocus
            className="min-h-10 flex-1 rounded-full sm:flex-none bg-slate-100 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={`min-h-10 flex-1 rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none ${
              variant === "danger"
                ? "border border-red-200 bg-white text-red-700 hover:bg-red-600 hover:text-white"
                : "bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]"
            }`}
            disabled={isLoading}
            onClick={onConfirm}
            type="button"
          >
            {isLoading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
