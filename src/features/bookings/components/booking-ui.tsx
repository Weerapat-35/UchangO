import type { MyBooking } from "@/features/bookings";

// ส่วนแสดงผลที่ใช้ร่วมกันระหว่างหน้า "การจองของฉัน" และ "รายละเอียดการจอง"

export const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

export const monthFormatter = new Intl.DateTimeFormat("th-TH", { month: "short" });
export const weekdayFormatter = new Intl.DateTimeFormat("th-TH", { weekday: "long" });
export const yearFormatter = new Intl.DateTimeFormat("th-TH", { year: "numeric" });

export const PROGRESS_STEPS = ["จองคิว", "อู่ยืนยัน", "กำลังซ่อม", "เสร็จสิ้น"];

/* ---------- ตัวช่วยแปลงข้อมูลเป็นข้อความที่อ่านง่าย ---------- */

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatTime(time: string) {
  return `${time.slice(0, 5)} น.`;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} นาที`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours} ชั่วโมง ${remainingMinutes} นาที`
    : `${hours} ชั่วโมง`;
}

export function isActiveBooking(booking: MyBooking) {
  return booking.status === "pending" || booking.status === "confirmed";
}

export function getDaysUntil(booking: MyBooking) {
  const date = parseLocalDate(booking.booking_date);
  if (!date) {
    return null;
  }
  const diff = date.getTime() - startOfToday().getTime();
  return Math.round(diff / 86_400_000);
}

export function getRelativeDay(booking: MyBooking) {
  if (!isActiveBooking(booking)) {
    return null;
  }

  const days = getDaysUntil(booking);
  if (days === null) {
    return null;
  }

  if (days === 0) return { label: "วันนี้", tone: "hot" as const };
  if (days === 1) return { label: "พรุ่งนี้", tone: "hot" as const };
  if (days > 1) return { label: `อีก ${days} วัน`, tone: "soft" as const };
  return { label: "เลยวันนัดแล้ว", tone: "warn" as const };
}

export function getBookingTimestamp(booking: MyBooking) {
  return `${booking.booking_date}T${booking.booking_time}`;
}

/* ---------- สถานะ ---------- */

export const STATUS_META: Record<
  string,
  { badge: string; dot: string; hint: string }
> = {
  pending: {
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    dot: "bg-amber-500",
    hint: "รออู่ตรวจสอบและยืนยันคิวของคุณ",
  },
  confirmed: {
    badge: "bg-sky-50 text-sky-800 ring-sky-200",
    dot: "bg-sky-500",
    hint: "อู่ยืนยันคิวแล้ว มาตามวันและเวลาที่จองได้เลย",
  },
  completed: {
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    dot: "bg-emerald-500",
    hint: "งานเสร็จเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ",
  },
  cancelled: {
    badge: "bg-red-50 text-red-700 ring-red-200",
    dot: "bg-red-500",
    hint: "การจองนี้ถูกยกเลิกแล้ว",
  },
};

export function getStatusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.pending;
}

export function getProgressIndex(booking: MyBooking) {
  if (booking.status === "completed" || booking.repairJob?.status === "completed") {
    return 3;
  }
  if (booking.repairJob?.status === "in_progress") {
    return 2;
  }
  if (booking.status === "confirmed" || booking.repairJob?.status === "assigned") {
    return 1;
  }
  return 0;
}

export function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function DateBadge({ booking }: { booking: MyBooking }) {
  const date = parseLocalDate(booking.booking_date);
  const topColor = booking.status === "cancelled" ? "bg-red-400" : "bg-[var(--brand)]";

  return (
    <div className="flex h-[68px] w-[60px] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white text-center shadow-sm sm:h-[76px] sm:w-[68px]">
      <span className={`py-0.5 text-xs font-bold text-white ${topColor}`}>
        {date ? monthFormatter.format(date) : "-"}
      </span>
      <span className="grid flex-1 place-items-center text-2xl font-extrabold leading-none text-[var(--foreground)] sm:text-3xl">
        {date ? date.getDate() : "-"}
      </span>
    </div>
  );
}

export function ProgressTracker({ booking }: { booking: MyBooking }) {
  const current = getProgressIndex(booking);
  const allDone = current === PROGRESS_STEPS.length - 1;

  return (
    <ol aria-label="ขั้นตอนการจอง" className="flex items-start">
      {PROGRESS_STEPS.map((label, index) => {
        const done = index < current || allDone;
        const isCurrent = index === current && !allDone;
        const lineReached = index <= current || allDone;

        return (
          <li
            aria-current={isCurrent ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center text-center"
            key={label}
          >
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={`absolute left-[-50%] top-[13px] h-0.5 w-full ${
                  lineReached ? "bg-[var(--brand)]" : "bg-slate-200"
                }`}
              />
            ) : null}
            <span
              className={`relative z-10 grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                done
                  ? "bg-[var(--brand)] text-white"
                  : isCurrent
                    ? "border-2 border-[var(--brand)] bg-white text-[var(--brand)] shadow-[0_0_0_4px_rgba(215,25,32,.12)]"
                    : "border-2 border-slate-200 bg-white text-slate-400"
              }`}
            >
              {done ? <CheckIcon className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span
              className={`mt-1.5 text-xs leading-4 sm:text-[13px] ${
                done || isCurrent ? "font-bold text-[var(--foreground)]" : "text-[var(--muted)]"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}


export function formatDateTimeThai(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return `${date.getDate()} ${monthFormatter.format(date)} ${yearFormatter.format(date)} เวลา ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} น.`;
}

export function formatThaiDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) {
    return value;
  }

  return `${weekdayFormatter.format(date)} ${date.getDate()} ${monthFormatter.format(date)} ${yearFormatter.format(date)}`;
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const meta = getStatusMeta(status);

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ring-1 ring-inset ${meta.badge}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${meta.dot}`} />
      {label}
    </span>
  );
}
