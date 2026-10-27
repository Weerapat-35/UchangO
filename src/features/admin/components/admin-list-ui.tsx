"use client";

// ชิ้นส่วนหน้าตาที่ใช้ร่วมกันในหน้ารายการของแอดมิน (บริการ หมวดบริการ ทักษะช่าง การจองคิว งานซ่อม)
// ชื่อหน้าแสดงอยู่บนแถบบนแล้ว ในหน้าจึงมีแค่คำอธิบายสั้น ๆ กับปุ่มหลัก
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const adminInputClass =
  "mt-1.5 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-red-100";

export const adminTextareaClass =
  "mt-1.5 min-h-24 w-full resize-y rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-red-100";

export const adminLabelClass = "block text-sm font-semibold text-[var(--foreground)]";

export const adminPrimaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-50";

export const adminSecondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export function AdminIcon({ name, className = "h-4 w-4" }: { name: "plus" | "edit" | "trash" | "search" | "close" | "clock" | "calendar" | "user" | "car" | "wrench" | "chevron"; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "plus": return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "edit": return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
    case "trash": return <svg {...common}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" /></svg>;
    case "search": return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    case "close": return <svg {...common}><path d="M6 6l12 12M18 6 6 18" /></svg>;
    case "clock": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "calendar": return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M16 2v4M8 2v4M3 9h18" /></svg>;
    case "user": return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case "car": return <svg {...common}><path d="M5 17h14M6 17v2M18 17v2M3 13l2-6a2 2 0 0 1 2-1.4h10A2 2 0 0 1 19 7l2 6v4H3Z" /><circle cx="7.5" cy="13.5" r=".8" /><circle cx="16.5" cy="13.5" r=".8" /></svg>;
    case "wrench": return <svg {...common}><path d="M14.7 6.3a4.1 4.1 0 0 0-5.2 5.2L3.6 17.4a2.1 2.1 0 1 0 3 3l5.9-5.9a4.1 4.1 0 0 0 5.2-5.2l-2.6 2.6-2.2-2.2 2.6-2.6Z" /></svg>;
    case "chevron": return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>;
  }
}

/** คำอธิบายหน้า + ปุ่มหลัก (ชื่อหน้าอยู่บนแถบบนแล้ว) */
export function AdminPageIntro({ description, action }: { description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
      {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
    </div>
  );
}

export type AdminFilterOption<T extends string> = { value: T; label: string; count?: number };

/** ช่องค้นหา + ปุ่มกรองสถานะแบบแถบเดียว */
export function AdminFilterBar<T extends string>({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  filter,
  onFilterChange,
  trailing,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filters?: AdminFilterOption<T>[];
  filter?: T;
  onFilterChange?: (value: T) => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm lg:flex-row lg:items-center">
      <label className="relative flex-1">
        <span className="sr-only">{searchPlaceholder}</span>
        <AdminIcon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          className="min-h-11 w-full rounded-xl border border-transparent bg-slate-50 pl-10 pr-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:bg-white focus:ring-4 focus:ring-red-100"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          type="search"
          value={search}
        />
      </label>
      {filters && onFilterChange ? (
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist" aria-label="กรองตามสถานะ">
          {filters.map((option) => {
            const isActive = option.value === filter;
            return (
              <button
                aria-selected={isActive}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition ${
                  isActive ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                key={option.value}
                onClick={() => onFilterChange(option.value)}
                role="tab"
                type="button"
              >
                {option.label}
                {option.count !== undefined ? (
                  <span className={`rounded-full px-1.5 text-xs ${isActive ? "bg-red-50 text-[var(--brand)]" : "bg-white/70"}`}>{option.count}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {trailing}
    </div>
  );
}

const PILL_TONES = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  blue: "bg-sky-50 text-sky-700 ring-sky-100",
  red: "bg-red-50 text-red-700 ring-red-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  // โทนสีของเว็บ: แดง safety / ดำ asphalt / เขียว signal / เทา concrete
  attention: "bg-white text-[var(--color-safety)] ring-[var(--color-safety)]",
  brand: "bg-[var(--color-safety)] text-white ring-[var(--color-safety)]",
  dark: "bg-[var(--color-asphalt)] text-white ring-[var(--color-asphalt)]",
  done: "bg-[#e8f3ec] text-[var(--color-signal)] ring-[#cfe5d8]",
  muted: "bg-[var(--color-concrete-2)] text-[var(--muted)] ring-[var(--line)]",
} as const;

export type AdminPillTone = keyof typeof PILL_TONES;

export function AdminPill({ tone, children }: { tone: AdminPillTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${PILL_TONES[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export function AdminActiveSwitch({ active, disabled, onToggle, label }: { active: boolean; disabled?: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      aria-checked={active}
      aria-label={label}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${active ? "bg-emerald-500" : "bg-slate-300"}`}
      disabled={disabled}
      onClick={onToggle}
      role="switch"
      title={active ? "เปิดใช้งาน (กดเพื่อปิด)" : "ปิดใช้งาน (กดเพื่อเปิด)"}
      type="button"
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${active ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export function AdminIconButton({ icon, label, onClick, tone = "default", disabled }: { icon: "edit" | "trash"; label: string; onClick: () => void; tone?: "default" | "danger"; disabled?: boolean }) {
  return (
    <button
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === "danger" ? "text-slate-400 hover:bg-red-50 hover:text-red-600" : "text-slate-500 hover:bg-slate-100 hover:text-[var(--foreground)]"
      }`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <AdminIcon name={icon} />
    </button>
  );
}

export function AdminEmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
      <p className="font-semibold text-[var(--foreground)]">{title}</p>
      {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** สถานะโหลด / ยังไม่ล็อกอิน / ไม่มีสิทธิ์ / ผิดพลาด ที่ทุกหน้าใช้เหมือนกัน */
export function AdminLoadMessage({ status, message, loadingLabel }: { status: "loading" | "signed-out" | "access-denied" | "error"; message?: string | null; loadingLabel?: string }) {
  if (status === "loading") {
    return (
      <div className="grid place-items-center py-20">
        <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--brand)]" aria-hidden="true" />
          {loadingLabel ?? "กำลังโหลด..."}
        </div>
      </div>
    );
  }
  if (status === "signed-out") {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-800">
        <p className="font-semibold">กรุณาเข้าสู่ระบบ</p>
        <p className="mt-1">กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ</p>
        <Link className={`${adminPrimaryButtonClass} mt-4 w-full`} href="/auth">ไปหน้าเข้าสู่ระบบ</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-sm leading-6 text-red-700">
      <p className="font-semibold">{status === "access-denied" ? "ไม่มีสิทธิ์เข้าถึง" : "โหลดข้อมูลไม่สำเร็จ"}</p>
      {message ? <p className="mt-1">{message}</p> : null}
    </div>
  );
}

/** ป้ายทะเบียนรถแบบป้ายจริง อ่านง่ายจากระยะไกล */
export function AdminPlate({ plate }: { plate: string | null | undefined }) {
  if (!plate) return <span className="text-sm text-[var(--muted)]">ไม่มีทะเบียน</span>;
  return (
    <span className="inline-flex min-h-8 items-center rounded-lg border-2 border-[var(--color-asphalt)] bg-white px-2.5 text-base font-bold tracking-wide text-[var(--color-asphalt)]">
      {plate}
    </span>
  );
}

/** หัวข้อกลุ่มตามวันที่ เช่น "วันนี้ · พฤหัสบดี 30 ต.ค." */
export function AdminDateHeading({ date, count, unit }: { date: string; count: number; unit: string }) {
  const value = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((value.getTime() - today.getTime()) / 86400000);
  const relative = diffDays === 0 ? "วันนี้" : diffDays === 1 ? "พรุ่งนี้" : diffDays === -1 ? "เมื่อวาน" : null;
  return (
    <div className="flex items-baseline gap-3">
      {relative ? <span className="rounded-full bg-[var(--color-safety)] px-2.5 py-0.5 text-xs font-bold text-white">{relative}</span> : null}
      <h2 className="text-base font-bold text-[var(--foreground)]">
        {value.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </h2>
      <span className="text-sm text-[var(--muted)]">{count} {unit}</span>
    </div>
  );
}

/** หน้าต่างกลางจอสำหรับเพิ่ม/แก้ไขข้อมูล */
export function AdminModal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose} role="presentation">
      <div
        aria-labelledby="admin-modal-title"
        aria-modal="true"
        className={`flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg"}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]" id="admin-modal-title">{title}</h2>
            {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
          </div>
          <button aria-label="ปิด" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <AdminIcon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] px-6 py-4 sm:flex-row sm:justify-end">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** แผงรายละเอียด: เลื่อนออกจากขวาบนจอกว้าง / ขึ้นจากด้านล่างบนมือถือ */
export function AdminDrawer({
  open,
  onClose,
  label,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="presentation">
      <button aria-label="ปิดแผงรายละเอียด" className="absolute inset-0 bg-[var(--color-asphalt)]/30" onClick={onClose} type="button" />
      <aside
        aria-label={label}
        aria-modal="true"
        className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl bg-white shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-3xl"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
          <p className="text-sm font-semibold text-[var(--muted)]">{label}</p>
          <button aria-label="ปิด" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--color-concrete-2)]" onClick={onClose} type="button">
            <AdminIcon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="space-y-2 border-t border-[var(--line)] px-6 py-4">{footer}</div> : null}
      </aside>
    </div>,
    document.body,
  );
}

/** แถวข้อมูลในแผงรายละเอียด: ไอคอน + หัวข้อเล็ก + ค่า */
export function AdminDetailItem({ icon, label, children }: { icon: "user" | "car" | "calendar" | "clock" | "wrench"; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-concrete-2)] text-[var(--muted)]"><AdminIcon name={icon} /></span>
      <div className="min-w-0">
        <p className="text-xs text-[var(--muted)]">{label}</p>
        <div className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">{children}</div>
      </div>
    </div>
  );
}

/** แจ้งผลการทำงานสั้น ๆ มุมล่างของจอ */
export function AdminToast({ message, tone = "success", onDone }: { message: string | null; tone?: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDone, 3500);
    return () => window.clearTimeout(timer);
  }, [message, onDone]);

  if (!message || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-6 z-[95] flex justify-center px-4" role="status">
      <div className={`rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${tone === "success" ? "bg-slate-900 text-white" : "bg-red-600 text-white"}`}>{message}</div>
    </div>,
    document.body,
  );
}
