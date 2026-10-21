"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  createVehicle,
  getCurrentUserVehicles,
  updateCurrentUserVehicle,
  type Vehicle,
} from "@/features/vehicles";
import { uploadVehicleImage, updateVehicleImageUrl } from "@/features/vehicles/image";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; vehicles: null; error: null; userId: null }
  | { status: "signed-out"; vehicles: null; error: null; userId: null }
  | { status: "ready"; vehicles: Vehicle[]; error: null; userId: string }
  | { status: "error"; vehicles: null; error: string; userId: null };

type VehicleFormValues = {
  brand: string;
  color: string;
  licensePlate: string;
  model: string;
  year: string;
  mileage: string;
};

type VehicleCardState =
  | { status: "view"; message: null; error: null }
  | { status: "edit"; message: null; error: null }
  | { status: "saving"; message: null; error: null }
  | { status: "saved"; message: string; error: null }
  | { status: "error"; message: null; error: string };

function getInitialValues(vehicle: Vehicle): VehicleFormValues {
  return {
    brand: vehicle.brand ?? "",
    color: vehicle.color ?? "",
    licensePlate: vehicle.license_plate,
    model: vehicle.model ?? "",
    year: vehicle.year ? String(vehicle.year) : "",
    mileage: vehicle.current_mileage == null ? "" : String(vehicle.current_mileage),
  };
}

function validateVehicle(values: VehicleFormValues) {
  if (!values.licensePlate.trim()) {
    return "กรุณากรอกทะเบียนรถ";
  }

  if (values.year.trim()) {
    const year = Number(values.year);
    const currentYear = new Date().getFullYear() + 1;

    if (!Number.isInteger(year) || year < 1950 || year > currentYear) {
      return `ปีรถต้องอยู่ระหว่าง 1950 ถึง ${currentYear}.`;
    }
  }

  return null;
}

function emptyValues(): VehicleFormValues {
  return { brand: "", color: "", licensePlate: "", model: "", year: "", mileage: "" };
}

type CreateState =
  | { status: "idle"; error: null; message: null }
  | { status: "saving"; error: null; message: null }
  | { status: "error"; error: string; message: null }
  | { status: "created"; error: null; message: string };

function AddVehicleForm({
  customerId,
  onVehicleCreated,
}: {
  customerId: string;
  onVehicleCreated: (vehicle: Vehicle) => void;
}) {
  const [values, setValues] = useState<VehicleFormValues>(emptyValues());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [createState, setCreateState] = useState<CreateState>({
    error: null,
    message: null,
    status: "idle",
  });

  function updateValue(field: keyof VehicleFormValues, value: string) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateVehicle(values);

    if (validationError) {
      setCreateState({ error: validationError, message: null, status: "error" });
      return;
    }

    if (values.mileage.trim() && (!Number.isInteger(Number(values.mileage)) || Number(values.mileage) < 0)) {
      setCreateState({ error: "เลขไมล์ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป", message: null, status: "error" });
      return;
    }

    setCreateState({ error: null, message: null, status: "saving" });

    const supabase = createClient();
    const { data, error } = await createVehicle(supabase, {
      brand: values.brand,
      color: values.color,
      customerId,
      licensePlate: values.licensePlate,
      model: values.model,
      year: values.year,
      mileage: values.mileage,
    });

    if (error) {
      setCreateState({ error: error.message, message: null, status: "error" });
      return;
    }

    let savedVehicle = data;
    if (imageFile) {
      const upload = await uploadVehicleImage(supabase, customerId, data.id, imageFile);
      if (upload.error) {
        setCreateState({ error: `เพิ่มข้อมูลรถแล้ว แต่ยังอัปโหลดรูปไม่สำเร็จ: ${upload.error.message}`, message: null, status: "error" });
        onVehicleCreated(data);
        return;
      }
      const imageUpdate = await updateVehicleImageUrl(supabase, customerId, data.id, upload.data.publicUrl);
      if (imageUpdate.error) {
        setCreateState({ error: `อัปโหลดรูปแล้ว แต่บันทึกรูปกับรถไม่สำเร็จ: ${imageUpdate.error.message}`, message: null, status: "error" });
        onVehicleCreated(data);
        return;
      }
      savedVehicle = imageUpdate.data as Vehicle;
    }

    onVehicleCreated(savedVehicle);
    setValues(emptyValues());
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setCreateState({
      error: null,
      message: "เพิ่มรถเรียบร้อยแล้ว",
      status: "created",
    });
  }

  return (
    <section className="mb-5 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
      <p className="text-sm font-semibold text-[var(--brand)]">＋ เพิ่มรถของคุณ</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        บันทึกข้อมูลรถไว้ล่วงหน้า เพื่อใช้จองคิวและจัดการข้อมูลได้สะดวก
      </p>

      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="text-sm font-medium text-[var(--foreground)]">
          ทะเบียนรถ
          <input
            className="mt-2 min-h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-red-500/10"
            onChange={(event) => updateValue("licensePlate", event.target.value)}
            placeholder="กก 1234"
            value={values.licensePlate}
          />
        </label>

        <label className="text-sm font-medium text-[var(--foreground)]">
          ยี่ห้อรถ
          <input
            className="mt-2 min-h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-red-500/10"
            onChange={(event) => updateValue("brand", event.target.value)}
            placeholder="Toyota"
            value={values.brand}
          />
        </label>

        <label className="text-sm font-medium text-[var(--foreground)]">
          รุ่นรถ
          <input
            className="mt-2 min-h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-red-500/10"
            onChange={(event) => updateValue("model", event.target.value)}
            placeholder="Yaris"
            value={values.model}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-medium text-[var(--foreground)]">
            ปีรถ
            <input
              className="mt-2 min-h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-red-500/10"
              inputMode="numeric"
              onChange={(event) => updateValue("year", event.target.value)}
              placeholder="2020"
              value={values.year}
            />
          </label>

          <label className="text-sm font-medium text-[var(--foreground)]">
            สีรถ
            <input
              className="mt-2 min-h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-red-500/10"
              onChange={(event) => updateValue("color", event.target.value)}
              placeholder="ขาว"
              value={values.color}
            />
          </label>
        </div>

        <label className="text-sm font-medium text-[var(--foreground)]">
          เลขไมล์ปัจจุบัน (กม.)
          <input className="mt-2 min-h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-red-500/10" inputMode="numeric" min="0" onChange={(event) => updateValue("mileage", event.target.value)} placeholder="เช่น 45000" value={values.mileage} />
        </label>
        <div className="text-sm font-medium text-[var(--foreground)]">
          รูปรถ (JPG, PNG, WEBP ไม่เกิน 2 MB)
          <div className="mt-2 flex items-center gap-3">
            {imagePreview ? <img alt="ตัวอย่างรูปรถ" className="h-16 w-20 rounded-lg border object-cover" src={imagePreview} /> : null}
            <input ref={imageInputRef} accept="image/jpeg,image/png,image/webp" className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-2 file:font-semibold file:text-red-700" onChange={(event) => { const file = event.target.files?.[0] ?? null; setImageFile(file); setImagePreview(file ? URL.createObjectURL(file) : null); }} type="file" />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-10 rounded-xl bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={createState.status === "saving"}
            type="submit"
          >
            {createState.status === "saving" ? "กำลังเพิ่ม..." : "เพิ่มรถ"}
          </button>

          {createState.status === "error" ? (
            <p className="text-sm text-red-700">{createState.error}</p>
          ) : null}

          {createState.status === "created" ? (
            <p className="text-sm font-semibold text-[var(--brand-strong)]">
              {createState.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function VehicleCard({
  customerId,
  onVehicleSaved,
  vehicle,
}: {
  customerId: string;
  onVehicleSaved: (vehicle: Vehicle) => void;
  vehicle: Vehicle;
}) {
  const [values, setValues] = useState<VehicleFormValues>(() =>
    getInitialValues(vehicle),
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(vehicle.image_url ?? null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [cardState, setCardState] = useState<VehicleCardState>({
    error: null,
    message: null,
    status: "view",
  });

  function updateValue(field: keyof VehicleFormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setCardState({
      error: null,
      message: null,
      status: "edit",
    });
  }

  function cancelแก้ไข() {
    setValues(getInitialValues(vehicle));
    setImageFile(null);
    setImagePreview(vehicle.image_url ?? null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setCardState({
      error: null,
      message: null,
      status: "view",
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateVehicle(values);

    if (validationError) {
      setCardState({
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    if (values.mileage.trim() && (!Number.isInteger(Number(values.mileage)) || Number(values.mileage) < 0)) {
      setCardState({ error: "เลขไมล์ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป", message: null, status: "error" });
      return;
    }

    setCardState({ error: null, message: null, status: "saving" });

    const supabase = createClient();
    const { data, error } = await updateCurrentUserVehicle(supabase, {
      brand: values.brand,
      color: values.color,
      customerId,
      id: vehicle.id,
      licensePlate: values.licensePlate,
      model: values.model,
      year: values.year,
      mileage: values.mileage,
    });

    if (error) {
      setCardState({ error: error.message, message: null, status: "error" });
      return;
    }

    let savedVehicle = data;
    if (imageFile) {
      const upload = await uploadVehicleImage(supabase, customerId, vehicle.id, imageFile);
      if (upload.error) {
        setCardState({ error: `บันทึกข้อมูลรถแล้ว แต่รูปอัปโหลดไม่สำเร็จ: ${upload.error.message}`, message: null, status: "error" });
        onVehicleSaved(data);
        return;
      }
      const imageUpdate = await updateVehicleImageUrl(supabase, customerId, vehicle.id, upload.data.publicUrl);
      if (imageUpdate.error) {
        setCardState({ error: imageUpdate.error.message, message: null, status: "error" });
        onVehicleSaved(data);
        return;
      }
      savedVehicle = imageUpdate.data as Vehicle;
    }

    onVehicleSaved(savedVehicle);
    setValues(getInitialValues(savedVehicle));
    setImageFile(null);
    setImagePreview(savedVehicle.image_url ?? null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setCardState({
      error: null,
      message: "บันทึกข้อมูลรถเรียบร้อยแล้ว",
      status: "saved",
    });
  }

  const isแก้ไขing =
    cardState.status === "edit" ||
    cardState.status === "saving" ||
    cardState.status === "error";

  return (
    <article className="rounded-[22px] border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-[156px_minmax(0,1fr)] sm:gap-4">
          <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 sm:h-[118px]">
            {imagePreview ? <img alt="รูปรถ" className="h-full w-full object-contain p-2" src={imagePreview} /> : <svg viewBox="0 0 160 90" className="h-full w-full p-3" role="img" aria-label="รูปรถยนต์">
              <path d="M24 53 32 35c2-5 7-8 13-9l15-3 13-12c3-3 7-5 12-5h22c6 0 11 3 14 8l11 16 8 4c5 2 8 7 8 12v15H24z" fill="#d1d5db" stroke="#6b7280" strokeWidth="2.5" strokeLinejoin="round"/>
              <path d="m47 33 13-3 12-12c2-2 4-3 7-3h11v18zM96 15h10c3 0 6 2 8 5l9 13H96z" fill="#f9fafb" stroke="#9ca3af" strokeWidth="1.5"/>
              <path d="M27 48h116M35 57h15m73 0h16" stroke="#9ca3af" strokeWidth="2"/>
              <circle cx="49" cy="61" r="11" fill="#374151"/><circle cx="49" cy="61" r="5" fill="#e5e7eb"/>
              <circle cx="121" cy="61" r="11" fill="#374151"/><circle cx="121" cy="61" r="5" fill="#e5e7eb"/>
              <path d="M28 43h9m107 0h-8" stroke="#ef4444" strokeWidth="4" strokeLinecap="round"/>
            </svg>}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-gray-900">รถยนต์คันที่ 1</p>
                <p className="mt-1 text-sm text-gray-500">
                  {[vehicle.brand, vehicle.model].filter(Boolean).join(" · ") || "รถยนต์ของคุณ"}
                </p>
              </div>
            </div>
            <div className="mt-2 rounded-xl border border-gray-200 px-3 py-2">
              <p className="text-xs text-gray-500">ทะเบียนรถ</p>
              {isแก้ไขing ? (
                <input
                  className="mt-1 min-h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-base font-semibold text-gray-900 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                  onChange={(event) => updateValue("licensePlate", event.target.value)}
                  value={values.licensePlate}
                />
              ) : (
                <p className="mt-1 text-base font-bold text-gray-900">{vehicle.license_plate}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-200 pt-5">
          <div>
            <p className="text-xs text-gray-500">ปีรถ</p>
            {isแก้ไขing ? (
              <input className="mt-1 min-h-9 w-full rounded-lg border border-gray-200 px-2 text-sm outline-none focus:border-red-500" inputMode="numeric" onChange={(event) => updateValue("year", event.target.value)} value={values.year} />
            ) : <p className="mt-1 text-base font-semibold text-gray-900">{vehicle.year ?? "-"}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-500">เลขไมล์ล่าสุด</p>
            {isแก้ไขing ? <input className="mt-1 min-h-9 w-full rounded-lg border border-gray-200 px-2 text-sm outline-none focus:border-red-500" inputMode="numeric" min="0" onChange={(event) => updateValue("mileage", event.target.value)} placeholder="เช่น 45000" value={values.mileage} /> : <p className="mt-1 text-base font-semibold text-gray-900">{vehicle.current_mileage == null ? "ยังไม่มีข้อมูล" : `${Number(vehicle.current_mileage).toLocaleString("th-TH")} กม.`}</p>}
          </div>
        </div>

        {isแก้ไขing ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-gray-600">ยี่ห้อรถ<input className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-red-500" onChange={(event) => updateValue("brand", event.target.value)} value={values.brand} /></label>
            <label className="text-xs font-medium text-gray-600">รุ่นรถ<input className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-red-500" onChange={(event) => updateValue("model", event.target.value)} value={values.model} /></label>
            <label className="text-xs font-medium text-gray-600">สีรถ<input className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-red-500" onChange={(event) => updateValue("color", event.target.value)} value={values.color} /></label>
            <label className="text-xs font-medium text-gray-600 sm:col-span-3">เปลี่ยนรูปรถ (JPG, PNG, WEBP ไม่เกิน 2 MB)<input ref={imageInputRef} accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-2 file:font-semibold file:text-red-700" onChange={(event) => { const file = event.target.files?.[0] ?? null; setImageFile(file); setImagePreview(file ? URL.createObjectURL(file) : (vehicle.image_url ?? null)); }} type="file" /></label>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {isแก้ไขing ? (
            <>
              <button className="min-h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50" onClick={cancelแก้ไข} type="button">ยกเลิก</button>
              <button className="min-h-12 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60" disabled={cardState.status === "saving"} type="submit">{cardState.status === "saving" ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</button>
            </>
          ) : (
            <>
              <button className="min-h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50" onClick={() => setCardState({ error: null, message: null, status: "edit" })} type="button">✎ แก้ไขข้อมูล</button>
              <Link className="inline-flex min-h-12 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700" href="/">▣ จองซ่อมรถคันนี้</Link>
            </>
          )}
        </div>
        {cardState.status === "saved" ? <p className="mt-3 text-sm font-medium text-emerald-700">{cardState.message}</p> : null}
        {cardState.status === "error" ? <p className="mt-3 text-sm text-red-700">{cardState.error}</p> : null}
      </form>
    </article>
  );
}

export function MyVehiclesPanel() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>({
    error: null,
    status: "loading",
    userId: null,
    vehicles: null,
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadVehicles() {
      setLoadState({
        error: null,
        status: "loading",
        userId: null,
        vehicles: null,
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
          status: "error",
          userId: null,
          vehicles: null,
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          error: null,
          status: "signed-out",
          userId: null,
          vehicles: null,
        });
        return;
      }

      const { data, error } = await getCurrentUserVehicles(
        supabase,
        session.user.id,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          error: error.message,
          status: "error",
          userId: null,
          vehicles: null,
        });
        return;
      }

      setLoadState({
        error: null,
        status: "ready",
        userId: session.user.id,
        vehicles: data ?? [],
      });
    }

    loadVehicles();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadVehicles();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function handleVehicleSaved(nextVehicle: Vehicle) {
    if (loadState.status !== "ready") {
      return;
    }

    setLoadState({
      ...loadState,
      vehicles: loadState.vehicles.map((vehicle) =>
        vehicle.id === nextVehicle.id ? nextVehicle : vehicle,
      ),
    });
  }

  function handleVehicleCreated(newVehicle: Vehicle) {
    if (loadState.status !== "ready") {
      return;
    }

    setLoadState({
      ...loadState,
      vehicles: [newVehicle, ...loadState.vehicles],
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-5 flex items-center justify-between gap-3 px-1 py-1">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-red-600 shadow-sm">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 11 1.5-4A2 2 0 0 1 8.4 5.5h7.2A2 2 0 0 1 17.5 7l1.5 4 1.5 1.5V18h-2v-2H5v2H3v-5.5L5 11Z" strokeLinejoin="round"/><path d="M6 11h12M7 13.5h.01M17 13.5h.01" strokeLinecap="round"/></svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">รถของฉัน</h1>
            <p className="mt-1 text-sm text-gray-500">จัดการข้อมูลรถยนต์ของคุณ</p>
          </div>
        </div>
        <button className="inline-flex min-h-12 shrink-0 items-center justify-center gap-1 rounded-2xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700" onClick={() => setShowAddForm((show) => !show)} type="button">＋ เพิ่มรถ</button>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดข้อมูลรถ...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">กรุณาเข้าสู่ระบบ</p>
            <p className="mt-1">เข้าสู่ระบบก่อนเพื่อดูข้อมูลรถของคุณ</p>
            <Link
              className="mt-4 block inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-5 py-2 text-center text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              href="/auth"
            >
              เข้าสู่ระบบ
            </Link>
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
        <section className="py-6">
          {showAddForm ? (
            <AddVehicleForm
              customerId={loadState.userId}
              onVehicleCreated={(vehicle) => { handleVehicleCreated(vehicle); setShowAddForm(false); }}
            />
          ) : null}

          {loadState.vehicles.length > 0 ? (
            <div className="space-y-4">
              {loadState.vehicles.map((vehicle) => (
                <VehicleCard
                  customerId={loadState.userId}
                  key={vehicle.id}
                  onVehicleSaved={handleVehicleSaved}
                  vehicle={vehicle}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-10 text-center text-sm leading-6 text-[var(--muted)]">
              ยังไม่มีข้อมูลรถ กดปุ่ม “＋ เพิ่มรถ” เพื่อเพิ่มรถของคุณ
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
