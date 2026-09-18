"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AppNav } from "@/components/app-nav";
import { getCurrentProfile, type Profile } from "@/features/auth";
import {
  createAuthenticatedBooking,
  getBookingOperatingStatus,
  getBookingSlotAvailabilities,
  type Booking,
  type BookingOperatingStatus,
  type BookingSlotAvailability,
} from "@/features/bookings";
import { createClient } from "@/lib/supabase/browser";
import {
  getServicesWithCategories,
  type Service,
  type ServiceCategoryWithServices,
} from "@/features/services";

type LoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: ServiceCategoryWithServices[]; error: null }
  | { status: "error"; data: null; error: string };

function CalendarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-safety">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-safety">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-safety">
      <path d="M4 16v-3l2-5h12l2 5v3" strokeLinejoin="round" />
      <path d="M4 16h16v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2Z" />
      <circle cx="7.5" cy="16" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="16" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-safety">
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-concrete/70">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2 2.6-2.6Z" strokeLinejoin="round" />
    </svg>
  );
}

type BookingFormValues = {
  customerName: string;
  phoneNumber: string;
  vehiclePlate: string;
  preferredDate: string;
  preferredTime: string;
  note: string;
};

type BookingFormErrors = Partial<
  Record<keyof Omit<BookingFormValues, "note">, string>
>;

type BookingSubmitState =
  | { status: "idle"; booking: null; error: null }
  | { status: "submitting"; booking: null; error: null }
  | {
      status: "success";
      booking: Booking;
      error: null;
      vehicleWasReused: boolean;
    }
  | { status: "error"; booking: null; error: string };

type AuthBookingState =
  | { status: "loading"; user: null; profile: null; error: null }
  | { status: "signed-out"; user: null; profile: null; error: null }
  | { status: "missing-profile"; user: User; profile: null; error: null }
  | { status: "ready"; user: User; profile: Profile; error: null }
  | { status: "error"; user: null; profile: null; error: string };

type AvailabilityState =
  | { status: "idle"; slots: null; operatingStatus: null; error: null }
  | { status: "loading"; slots: null; operatingStatus: null; error: null }
  | {
      status: "ready";
      slots: BookingSlotAvailability[];
      operatingStatus: BookingOperatingStatus | null;
      error: null;
    }
  | { status: "error"; slots: null; operatingStatus: null; error: string };

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});
const bookingStartTime = "09:00";
const bookingEndTime = "18:00";
const bookingSlotIntervalMinutes = 30;

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} นาที`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours} ชม. ${remainingMinutes} นาที`
    : `${hours} ชม.`;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toTimeValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const remainingMinutes = String(minutes % 60).padStart(2, "0");

  return `${hours}:${remainingMinutes}`;
}

function getBookingTimeOptions(selectedDate: string, today: string, now: Date) {
  const startMinutes = timeToMinutes(bookingStartTime);
  const endMinutes = timeToMinutes(bookingEndTime);
  const currentMinutes = timeToMinutes(toTimeValue(now));

  return Array.from(
    {
      length:
        Math.floor((endMinutes - startMinutes) / bookingSlotIntervalMinutes) +
        1,
    },
    (_, index) => startMinutes + index * bookingSlotIntervalMinutes,
  )
    .map(minutesToTime)
    .filter((time) => {
      if (selectedDate !== today) {
        return true;
      }

      return timeToMinutes(time) > currentMinutes;
    });
}

function isBookingTimeWithinBusinessHours(time: string) {
  const minutes = timeToMinutes(time);

  return (
    minutes >= timeToMinutes(bookingStartTime) &&
    minutes <= timeToMinutes(bookingEndTime)
  );
}

function isBookingDateTimeInPast(date: string, time: string) {
  const bookingDateTime = new Date(`${date}T${time}`);

  if (Number.isNaN(bookingDateTime.getTime())) {
    return false;
  }

  return bookingDateTime.getTime() < Date.now();
}

function getBookingErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("bcare booking slot is full")) {
    return "เวลานี้คิวเต็มแล้ว กรุณาเลือกเวลาอื่น";
  }

  if (normalizedMessage.includes("bcare booking slot is closed")) {
    return "เวลานี้ปิดรับจองแล้ว กรุณาเลือกเวลาอื่น";
  }

  if (normalizedMessage.includes("shop is closed")) {
    return "ร้านปิดในวันที่เลือก กรุณาเลือกวันอื่น";
  }

  if (normalizedMessage.includes("outside operating hours")) {
    return "เวลานี้อยู่นอกเวลาทำการ กรุณาเลือกเวลาอื่น";
  }

  if (normalizedMessage.includes("outside business hours")) {
    return "เวลาจองต้องอยู่ระหว่าง 09:00 ถึง 18:00";
  }

  if (normalizedMessage.includes("09:00 to 18:00")) {
    return "เวลาจองต้องอยู่ระหว่าง 09:00 ถึง 18:00";
  }

  if (normalizedMessage.includes("row-level security")) {
    return "ระบบฐานข้อมูลไม่อนุญาตให้บันทึกการจองนี้ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง";
  }

  if (normalizedMessage.includes("get_garage_slot_availability")) {
    return "ระบบตรวจเวลาว่างยังไม่พร้อมใช้งาน กรุณาให้ผู้ดูแลรัน SQL ของ Step 10 Part 1 ก่อน";
  }

  if (normalizedMessage.includes("get_garage_operating_status")) {
    return "ระบบตรวจวันเปิดร้านยังไม่พร้อมใช้งาน กรุณาให้ผู้ดูแลรัน SQL ของ Step 10 Part 5.1 ก่อน";
  }

  if (normalizedMessage.includes("not-null constraint")) {
    return "ข้อมูลที่จำเป็นบางส่วนยังไม่ครบ กรุณาตรวจฟอร์มแล้วลองอีกครั้ง";
  }

  return message;
}

function getClosedDayMessage(operatingStatus: BookingOperatingStatus | null) {
  if (!operatingStatus) {
    return "ร้านปิดในวันที่เลือก กรุณาเลือกวันอื่น";
  }

  if (operatingStatus.isSpecialClosed) {
    return `ร้านปิดในวันที่เลือก: ${operatingStatus.closedReason ?? "วันหยุดพิเศษ"}`;
  }

  return operatingStatus.note
    ? `ร้านปิดในวันที่เลือก: ${operatingStatus.note}`
    : "ร้านปิดในวันที่เลือก กรุณาเลือกวันอื่น";
}

function getServicesCount(categories: ServiceCategoryWithServices[]) {
  return categories.reduce(
    (total, category) => total + category.services.length,
    0,
  );
}

function findSelectedService(
  categories: ServiceCategoryWithServices[],
  selectedServiceId: string | null,
) {
  if (!selectedServiceId) {
    return null;
  }

  return (
    categories
      .flatMap((category) => category.services)
      .find((service) => service.id === selectedServiceId) ?? null
  );
}

function ServiceCard({
  isSelected,
  onSelect,
  service,
}: {
  isSelected: boolean;
  onSelect: () => void;
  service: Service;
}) {
  return (
    <article
      className={
        isSelected
          ? "flex flex-col rounded-xl border-2 border-[var(--brand)] bg-white p-5 shadow-sm"
          : "flex flex-col rounded-xl border border-[var(--line)] bg-white p-5 shadow-sm"
      }
    >
      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--concrete-2)] px-3 py-1 text-xs font-bold text-[var(--brand-strong)]">
        ราคา {currencyFormatter.format(service.base_price)}
      </span>

      <h3 className="mt-3 font-display text-base font-bold leading-tight text-[var(--brand-strong)]">
        {service.name}
      </h3>

      {service.description ? (
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
          {service.description}
        </p>
      ) : null}

      <button
        className={
          isSelected
            ? "mt-4 min-h-10 rounded-md border border-[var(--brand)] bg-concrete-2 px-3 text-sm font-bold text-[var(--brand-strong)]"
            : "mt-4 min-h-10 rounded-md bg-[var(--brand)] px-3 text-sm font-bold text-white transition hover:bg-[var(--brand-strong)]"
        }
        onClick={onSelect}
        type="button"
      >
        {isSelected ? "เลือกแล้ว ✓" : "จองด่วน →"}
      </button>
    </article>
  );
}

function getInitialBookingValues(profile: Profile | null): BookingFormValues {
  return {
    customerName: profile?.full_name ?? "",
    note: "",
    phoneNumber: profile?.phone_number ?? "",
    preferredDate: "",
    preferredTime: "",
    vehiclePlate: "",
  };
}

function BookingForm({
  authState,
  service,
}: {
  authState: AuthBookingState;
  service: Service;
}) {
  const [values, setValues] = useState<BookingFormValues>(() =>
    authState.status === "ready"
      ? getInitialBookingValues(authState.profile)
      : getInitialBookingValues(null),
  );
  const [errors, setErrors] = useState<BookingFormErrors>({});
  const [submitState, setSubmitState] = useState<BookingSubmitState>({
    booking: null,
    error: null,
    status: "idle",
  });
  const [availabilityState, setAvailabilityState] =
    useState<AvailabilityState>({
      error: null,
      operatingStatus: null,
      slots: null,
      status: "idle",
    });
  const now = new Date();
  const todayInputValue = toDateInputValue(now);
  const baseBookingTimeOptions = getBookingTimeOptions(
    values.preferredDate,
    todayInputValue,
    now,
  );
  const availableSlotsByTime = useMemo(() => {
    if (availabilityState.status !== "ready") {
      return new Map<string, BookingSlotAvailability>();
    }

    return new Map(
      availabilityState.slots.map((slot) => [slot.bookingTime, slot]),
    );
  }, [availabilityState]);
  const bookingTimeOptions =
    availabilityState.status === "ready"
      ? baseBookingTimeOptions.filter(
          (time) => availableSlotsByTime.get(time)?.isOpen,
        )
      : [];

  useEffect(() => {
    let isMounted = true;

    async function loadAvailability() {
      if (authState.status !== "ready" || !values.preferredDate) {
        setAvailabilityState({
          error: null,
          operatingStatus: null,
          slots: null,
          status: "idle",
        });
        return;
      }

      const currentNow = new Date();
      const nextTimeOptions = getBookingTimeOptions(
        values.preferredDate,
        toDateInputValue(currentNow),
        currentNow,
      );

      if (nextTimeOptions.length === 0) {
        setAvailabilityState({
          error: null,
          operatingStatus: null,
          slots: [],
          status: "ready",
        });
        return;
      }

      setAvailabilityState({
        error: null,
        operatingStatus: null,
        slots: null,
        status: "loading",
      });

      const supabase = createClient();
      const operatingStatusResult = await getBookingOperatingStatus(
        supabase,
        values.preferredDate,
      );

      if (!isMounted) {
        return;
      }

      if (operatingStatusResult.error) {
        setAvailabilityState({
          error: getBookingErrorMessage(operatingStatusResult.error.message),
          operatingStatus: null,
          slots: null,
          status: "error",
        });
        return;
      }

      if (
        operatingStatusResult.data &&
        !operatingStatusResult.data.isOpen
      ) {
        setAvailabilityState({
          error: null,
          operatingStatus: operatingStatusResult.data,
          slots: [],
          status: "ready",
        });
        return;
      }

      const { data, error } = await getBookingSlotAvailabilities(
        supabase,
        values.preferredDate,
        nextTimeOptions,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setAvailabilityState({
          error: getBookingErrorMessage(error.message),
          operatingStatus: null,
          slots: null,
          status: "error",
        });
        return;
      }

      setAvailabilityState({
        error: null,
        operatingStatus: operatingStatusResult.data,
        slots: data ?? [],
        status: "ready",
      });
    }

    loadAvailability();

    return () => {
      isMounted = false;
    };
  }, [authState.status, values.preferredDate]);

  if (authState.status === "loading") {
    return (
      <div className="mt-5 rounded-lg border border-[var(--line)] bg-slate-50 p-4 text-sm text-[var(--muted)]">
        กำลังตรวจสอบสถานะเข้าสู่ระบบ...
      </div>
    );
  }

  if (authState.status === "signed-out") {
    return (
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
        <p className="font-semibold">ต้องเข้าสู่ระบบก่อน</p>
        <p className="mt-1">กรุณาเข้าสู่ระบบหรือสมัครสมาชิกก่อนสร้างการจอง</p>
        <Link
          className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
          href="/auth"
        >
          ไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  if (authState.status === "missing-profile") {
    return (
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
        <p className="font-semibold">ต้องมีโปรไฟล์ลูกค้าก่อน</p>
        <p className="mt-1">
          กรุณาบันทึกโปรไฟล์ลูกค้าก่อนสร้างการจอง
        </p>
        <Link
          className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
          href="/auth"
        >
          กรอกโปรไฟล์
        </Link>
      </div>
    );
  }

  if (authState.status === "error") {
    return (
      <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
        {authState.error}
      </div>
    );
  }

  function updateValue(field: keyof BookingFormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setSubmitState({
      booking: null,
      error: null,
      status: "idle",
    });
  }

  function validateForm() {
    const nextErrors: BookingFormErrors = {};

    if (!values.customerName.trim()) {
      nextErrors.customerName = "กรุณากรอกชื่อลูกค้า";
    }

    if (!values.phoneNumber.trim()) {
      nextErrors.phoneNumber = "กรุณากรอกเบอร์โทร";
    }

    if (!values.vehiclePlate.trim()) {
      nextErrors.vehiclePlate = "กรุณากรอกทะเบียนรถ";
    }

    if (!values.preferredDate) {
      nextErrors.preferredDate = "กรุณาเลือกวันที่ต้องการจอง";
    }

    if (
      values.preferredDate &&
      availabilityState.status === "ready" &&
      availabilityState.operatingStatus &&
      !availabilityState.operatingStatus.isOpen
    ) {
      nextErrors.preferredTime = getClosedDayMessage(
        availabilityState.operatingStatus,
      );
    }

    if (!values.preferredTime && !nextErrors.preferredTime) {
      nextErrors.preferredTime = "กรุณาเลือกเวลาที่ต้องการจอง";
    }

    if (values.preferredDate && availabilityState.status === "loading") {
      nextErrors.preferredTime = "กำลังตรวจสอบเวลาว่าง";
    }

    if (values.preferredDate && availabilityState.status === "error") {
      nextErrors.preferredTime = availabilityState.error;
    }

    if (
      values.preferredTime &&
      !isBookingTimeWithinBusinessHours(values.preferredTime)
    ) {
      nextErrors.preferredTime = "กรุณาเลือกเวลาระหว่าง 09:00 ถึง 18:00";
    }

    if (
      values.preferredDate &&
      values.preferredTime &&
      isBookingDateTimeInPast(values.preferredDate, values.preferredTime)
    ) {
      nextErrors.preferredTime = "วันและเวลาจองต้องเป็นเวลาในอนาคต";
    }

    if (
      values.preferredTime &&
      availabilityState.status === "ready" &&
      !bookingTimeOptions.includes(values.preferredTime)
    ) {
      nextErrors.preferredTime =
        "เวลานี้ไม่ว่างแล้ว กรุณาเลือกเวลาอื่น";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateForm()) {
      setSubmitState({
        booking: null,
        error: null,
        status: "idle",
      });
      return;
    }

    if (authState.status !== "ready") {
      setSubmitState({
        booking: null,
        error: "กรุณาเข้าสู่ระบบและบันทึกโปรไฟล์ก่อนส่งคำขอจอง",
        status: "error",
      });
      return;
    }

    setSubmitState({
      booking: null,
      error: null,
      status: "submitting",
    });

    const supabase = createClient();
    const { data, error } = await createAuthenticatedBooking(supabase, {
      customerId: authState.profile.id,
      note: values.note.trim(),
      preferredDate: values.preferredDate,
      preferredTime: values.preferredTime,
      serviceId: service.id,
      vehiclePlate: values.vehiclePlate.trim(),
    });

    if (error) {
      setSubmitState({
        booking: null,
        error: getBookingErrorMessage(error.message),
        status: "error",
      });
      return;
    }

    setSubmitState({
      booking: data.booking,
      error: null,
      status: "success",
      vehicleWasReused: data.vehicleWasReused,
    });
  }

  return (
    <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
      <div>
        <label
          className="text-sm font-medium text-[var(--foreground)]"
          htmlFor="customerName"
        >
          ชื่อลูกค้า
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-slate-50 px-3 text-sm text-[var(--foreground)] outline-none"
          id="customerName"
          readOnly
          value={values.customerName}
        />
        {errors.customerName ? (
          <p className="mt-1 text-xs text-red-700">{errors.customerName}</p>
        ) : null}
      </div>

      <div>
        <label
          className="text-sm font-medium text-[var(--foreground)]"
          htmlFor="phoneNumber"
        >
          เบอร์โทร
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-slate-50 px-3 text-sm text-[var(--foreground)] outline-none"
          id="phoneNumber"
          inputMode="tel"
          readOnly
          value={values.phoneNumber}
        />
        {errors.phoneNumber ? (
          <p className="mt-1 text-xs text-red-700">{errors.phoneNumber}</p>
        ) : null}
      </div>

      <div>
        <label
          className="text-sm font-medium text-[var(--foreground)]"
          htmlFor="vehiclePlate"
        >
          ทะเบียนรถ
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          id="vehiclePlate"
          onChange={(event) => updateValue("vehiclePlate", event.target.value)}
          value={values.vehiclePlate}
        />
        {errors.vehiclePlate ? (
          <p className="mt-1 text-xs text-red-700">{errors.vehiclePlate}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            className="text-sm font-medium text-[var(--foreground)]"
            htmlFor="preferredDate"
          >
            วันที่
          </label>
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            id="preferredDate"
            min={todayInputValue}
            onChange={(event) => {
              updateValue("preferredDate", event.target.value);

              if (values.preferredTime) {
                updateValue("preferredTime", "");
              }
            }}
            type="date"
            value={values.preferredDate}
          />
          {errors.preferredDate ? (
            <p className="mt-1 text-xs text-red-700">{errors.preferredDate}</p>
          ) : null}
        </div>

        <div>
          <label
            className="text-sm font-medium text-[var(--foreground)]"
            htmlFor="preferredTime"
          >
            เวลา
          </label>
          <select
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            id="preferredTime"
            disabled={
              !values.preferredDate ||
              availabilityState.status === "loading" ||
              availabilityState.status === "error" ||
              bookingTimeOptions.length === 0
            }
            onChange={(event) =>
              updateValue("preferredTime", event.target.value)
            }
            value={values.preferredTime}
          >
            <option value="">
              {!values.preferredDate
                ? "เลือกวันที่ก่อน"
                : availabilityState.status === "loading"
                  ? "กำลังตรวจสอบเวลาว่าง"
                  : availabilityState.status === "ready" &&
                      availabilityState.operatingStatus &&
                      !availabilityState.operatingStatus.isOpen
                    ? "ร้านปิดวันนี้"
                  : "เลือกเวลา"}
            </option>
            {bookingTimeOptions.map((time) => (
              <option key={time} value={time}>
                {time}
                {availableSlotsByTime.has(time)
                  ? ` (เหลือ ${availableSlotsByTime.get(time)?.availableBookingCount} คิว)`
                  : ""}
              </option>
            ))}
          </select>
          {values.preferredDate && availabilityState.status === "loading" ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              กำลังตรวจสอบเวลาที่จองได้
            </p>
          ) : null}
          {values.preferredDate && availabilityState.status === "error" ? (
            <p className="mt-1 text-xs text-red-700">
              {availabilityState.error}
            </p>
          ) : null}
          {values.preferredDate &&
          availabilityState.status === "ready" &&
          bookingTimeOptions.length === 0 ? (
            <p className="mt-1 text-xs text-amber-700">
              {availabilityState.operatingStatus &&
              !availabilityState.operatingStatus.isOpen
                ? getClosedDayMessage(availabilityState.operatingStatus)
                : "วันนี้ไม่มีเวลาว่างให้จองแล้ว"}
            </p>
          ) : null}
          {!values.preferredDate || availabilityState.status === "idle" ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              เลือกวันที่เพื่อดูเวลาที่จองได้ระหว่าง 09:00 ถึง 18:00
            </p>
          ) : null}
          {availabilityState.status === "ready" &&
          bookingTimeOptions.length > 0 ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              แสดงเฉพาะเวลาที่ยังเปิดรับและยังมีคิวว่าง
            </p>
          ) : null}
          {errors.preferredTime ? (
            <p className="mt-1 text-xs text-red-700">{errors.preferredTime}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label
          className="text-sm font-medium text-[var(--foreground)]"
          htmlFor="note"
        >
          หมายเหตุ
        </label>
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          id="note"
          onChange={(event) => updateValue("note", event.target.value)}
          value={values.note}
        />
      </div>

      <button
        className="min-h-11 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={
          submitState.status === "submitting" ||
          submitState.status === "success"
        }
        type="submit"
      >
        {submitState.status === "success"
          ? "บันทึกการจองแล้ว"
          : submitState.status === "submitting"
            ? "กำลังบันทึกการจอง..."
            : "ส่งคำขอจอง"}
      </button>

      <p className="text-xs leading-5 text-[var(--muted)]">
        ชื่อและเบอร์โทรมาจากโปรไฟล์ที่บันทึกไว้ หากต้องการแก้ไขให้ไปที่หน้าบัญชี
      </p>

      {submitState.status === "success" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-[var(--brand-strong)]">
          <p className="font-semibold">บันทึกคำขอจองแล้ว</p>
          <p className="mt-2">
            {values.customerName} เลือกบริการ {service.name} วันที่{" "}
            {values.preferredDate} เวลา {values.preferredTime}
          </p>
          <p className="mt-2 break-all text-xs">
            รหัสการจอง: {submitState.booking.id}
          </p>
          <p className="mt-2 text-xs">
            รถ:{" "}
            {submitState.vehicleWasReused
              ? "ใช้ข้อมูลรถที่มีอยู่แล้ว"
              : "สร้างข้อมูลรถใหม่"}
          </p>
          <Link
            className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
            href="/my-bookings"
          >
            ดูการจองของฉัน
          </Link>
        </div>
      ) : null}

      {submitState.status === "error" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
          <p className="font-semibold">ส่งคำขอจองไม่สำเร็จ</p>
          <p className="mt-2">{submitState.error}</p>
        </div>
      ) : null}
    </form>
  );
}

export function ServicesListing() {
  const [loadState, setLoadState] = useState<LoadState>({
    data: null,
    error: null,
    status: "loading",
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [authState, setAuthState] = useState<AuthBookingState>({
    error: null,
    profile: null,
    status: "loading",
    user: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadServices() {
      const supabase = createClient();
      const { data, error } = await getServicesWithCategories(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          data: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setLoadState({
        data: data ?? [],
        error: null,
        status: "ready",
      });
    }

    loadServices();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadAuthState() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthState({
          error: error.message,
          profile: null,
          status: "error",
          user: null,
        });
        return;
      }

      if (!session?.user) {
        setAuthState({
          error: null,
          profile: null,
          status: "signed-out",
          user: null,
        });
        return;
      }

      const profileResult = await getCurrentProfile(supabase, session.user.id);

      if (!isMounted) {
        return;
      }

      if (profileResult.error) {
        setAuthState({
          error: profileResult.error.message,
          profile: null,
          status: "error",
          user: null,
        });
        return;
      }

      if (!profileResult.data) {
        setAuthState({
          error: null,
          profile: null,
          status: "missing-profile",
          user: session.user,
        });
        return;
      }

      setAuthState({
        error: null,
        profile: profileResult.data,
        status: "ready",
        user: session.user,
      });
    }

    loadAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadAuthState();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const categories = useMemo(() => loadState.data ?? [], [loadState.data]);
  const serviceCount = getServicesCount(categories);
  const selectedService = useMemo(
    () => findSelectedService(categories, selectedServiceId),
    [categories, selectedServiceId],
  );
  const visibleCategories = useMemo(() => {
    if (selectedCategoryId === "all") {
      return categories;
    }

    return categories.filter((category) => category.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
      <div className="mb-5">
        <AppNav />
      </div>

      <header className="overflow-hidden rounded-2xl bg-asphalt">
        <div className="flex flex-col gap-6 px-6 py-10 sm:px-10 sm:py-14 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-concrete/20 px-3 py-1 font-display text-xs font-semibold uppercase tracking-widest text-safety">
              เปิดบริการ จ.–ส. 09:00–18:00
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] text-concrete sm:text-5xl">
              ซ่อมรถให้ตรงจุด
              <br />
              <span className="text-safety">จองคิวได้จริง</span> ไม่ต้องเดา
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-concrete/70">
              เลือกบริการซ่อมและบำรุงรักษารถ ดูช่วงเวลาที่ว่างแบบเรียลไทม์
              แล้วส่งคำขอจองด้วยโปรไฟล์ลูกค้าของคุณ
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#services"
                className="rounded-md bg-safety px-5 py-2.5 text-sm font-semibold text-asphalt transition hover:bg-safety-dim"
              >
                จองบริการตอนนี้
              </a>
              <Link
                href="/products"
                className="rounded-md border border-concrete/25 px-5 py-2.5 text-sm font-semibold text-concrete transition hover:border-concrete/50"
              >
                ดูสินค้าและอะไหล่
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:w-72">
            <div className="rounded-xl border border-concrete/15 bg-asphalt-2 p-4">
              <p className="font-mono text-xs uppercase tracking-wide text-concrete/50">
                หมวดหมู่
              </p>
              <p className="mt-1 font-display text-3xl font-bold text-concrete">
                {loadState.status === "ready" ? categories.length : "–"}
              </p>
            </div>
            <div className="rounded-xl border border-concrete/15 bg-asphalt-2 p-4">
              <p className="font-mono text-xs uppercase tracking-wide text-concrete/50">
                บริการ
              </p>
              <p className="mt-1 font-display text-3xl font-bold text-concrete">
                {loadState.status === "ready" ? serviceCount : "–"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <a
          href="#services"
          className="flex flex-col items-center gap-2 rounded-xl bg-[var(--foreground)] px-3 py-5 text-center transition hover:bg-black"
        >
          <CalendarIcon />
          <span className="text-sm font-semibold text-white">จองคิวซ่อม</span>
        </a>
        <Link
          href="/my-bookings"
          className="flex flex-col items-center gap-2 rounded-xl bg-[var(--foreground)] px-3 py-5 text-center transition hover:bg-black"
        >
          <ClockIcon />
          <span className="text-sm font-semibold text-white">ประวัติการจอง</span>
        </Link>
        <Link
          href="/my-vehicles"
          className="flex flex-col items-center gap-2 rounded-xl bg-[var(--foreground)] px-3 py-5 text-center transition hover:bg-black"
        >
          <CarIcon />
          <span className="text-sm font-semibold text-white">รถของฉัน</span>
        </Link>
        <a
          href="tel:0200000000"
          className="flex flex-col items-center gap-2 rounded-xl bg-[var(--foreground)] px-3 py-5 text-center transition hover:bg-black"
        >
          <PhoneIcon />
          <span className="text-sm font-semibold text-white">ติดต่อช่าง</span>
        </a>
      </div>

      {loadState.status === "ready" && categories.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[var(--foreground)]">บริการแนะนำ</h2>
            <a href="#services" className="text-sm font-semibold text-safety">
              ดูทั้งหมด →
            </a>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {categories.slice(0, 3).map((category, index) => (
              <div
                key={category.id}
                className="overflow-hidden rounded-xl border border-[var(--line)] bg-white"
              >
                <div
                  className={`flex h-32 items-center justify-center ${
                    ["bg-steel", "bg-asphalt", "bg-safety-dim"][index % 3]
                  }`}
                >
                  <WrenchIcon />
                </div>
                <div className="p-4">
                  <p className="font-semibold text-[var(--foreground)]">{category.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                    {category.services.length} บริการในหมวดนี้
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div id="services" />

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดบริการ...
          </div>
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
        <section className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                className={
                  selectedCategoryId === "all"
                    ? "min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                    : "min-h-10 shrink-0 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                }
                onClick={() => setSelectedCategoryId("all")}
                type="button"
              >
                บริการทั้งหมด
              </button>
              {categories.map((category) => (
                <button
                  className={
                    selectedCategoryId === category.id
                      ? "min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                      : "min-h-10 shrink-0 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                  }
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  type="button"
                >
                  {category.name}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-8">
              {visibleCategories.map((category) => (
                <section key={category.id}>
                  <div className="flex flex-col gap-2 border-b border-[var(--line)] pb-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--foreground)]">
                        {category.name}
                      </h2>
                      {category.description ? (
                        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                          {category.description}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium text-[var(--muted)]">
                      {category.services.length} บริการ
                    </p>
                  </div>

                  {category.services.length > 0 ? (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {category.services.map((service) => (
                        <ServiceCard
                          isSelected={selectedServiceId === service.id}
                          key={service.id}
                          onSelect={() =>
                            setSelectedServiceId((currentServiceId) =>
                              currentServiceId === service.id ? null : service.id,
                            )
                          }
                          service={service}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-dashed border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)]">
                      ยังไม่มีบริการที่เปิดใช้งานในหมวดหมู่นี้
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>

          <aside className="h-fit rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <p className="text-sm font-semibold text-[var(--brand)]">
              บริการที่เลือก
            </p>
            {selectedService ? (
              <div className="mt-4">
                <h2 className="text-xl font-bold leading-7 text-[var(--foreground)]">
                  {selectedService.name}
                </h2>
                {selectedService.description ? (
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    {selectedService.description}
                  </p>
                ) : null}
                <dl className="mt-5 space-y-3 border-t border-[var(--line)] pt-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--muted)]">ราคาเริ่มต้น</dt>
                    <dd className="font-semibold text-[var(--foreground)]">
                      {currencyFormatter.format(selectedService.base_price)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--muted)]">เวลาโดยประมาณ</dt>
                    <dd className="font-semibold text-[var(--foreground)]">
                      {formatDuration(
                        selectedService.estimated_duration_minutes,
                      )}
                    </dd>
                  </div>
                </dl>
                <BookingForm
                  authState={authState}
                  key={`${selectedService.id}-${authState.status === "ready" ? authState.profile.id : authState.status}`}
                  service={selectedService}
                />
                <button
                  className="mt-3 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                  onClick={() => setSelectedServiceId(null)}
                  type="button"
                >
                  ล้างการเลือก
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--line)] bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]">
                เลือกบริการหนึ่งรายการเพื่อเริ่มกรอกคำขอจอง
              </div>
            )}
          </aside>
        </section>
      ) : null}
    </main>
  );
}
