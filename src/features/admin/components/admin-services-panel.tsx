"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  checkAdminAccess,
  createAdminService,
  deleteAdminService,
  getAdminDeleteErrorMessage,
  getAdminServiceCategories,
  getAdminServices,
  updateAdminService,
  type AdminAccessResult,
  type AdminService,
  type AdminServiceCategory,
  type AdminServiceCreateInput,
  type AdminServiceUpdateInput,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";
import { recordStatusLabel } from "@/lib/status-labels";

type LoadState =
  | {
      status: "loading";
      access: null;
      categories: null;
      services: null;
      error: null;
    }
  | {
      status: "signed-out";
      access: null;
      categories: null;
      services: null;
      error: null;
    }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      categories: null;
      services: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      categories: AdminServiceCategory[];
      services: AdminService[];
      error: null;
    }
  | {
      status: "error";
      access: null;
      categories: null;
      services: null;
      error: string;
    };

type ActionState =
  | { status: "idle"; serviceId: null; error: null; message: null }
  | { status: "saving"; serviceId: string; error: null; message: null }
  | { status: "deleting"; serviceId: string; error: null; message: null }
  | { status: "error"; serviceId: string; error: string; message: null }
  | { status: "saved"; serviceId: string; error: null; message: string };

type CreateState =
  | { status: "idle"; error: null; message: null }
  | { status: "creating"; error: null; message: null }
  | { status: "error"; error: string; message: null }
  | { status: "created"; error: null; message: string };

type StatusFilter = "all" | AdminService["status"];

const statusFilters: StatusFilter[] = ["all", "active", "inactive"];
const serviceImagesBucket = "service-images";
const serviceImagePlaceholder = "/service-placeholder.svg";

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function getStatusStyle(status: AdminService["status"]) {
  if (status === "active") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  return "bg-slate-100 text-slate-700";
}

function getSafeServiceImageExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

async function uploadServiceImage(file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return { error: "รองรับเฉพาะไฟล์ PNG, JPG หรือ WEBP", publicUrl: null };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { error: "ไฟล์รูปบริการต้องไม่เกิน 2 MB", publicUrl: null };
  }

  const extension = getSafeServiceImageExtension(file);
  const uploadPath = `services/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const supabase = createClient();
  const result = await supabase.storage.from(serviceImagesBucket).upload(uploadPath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (result.error) {
    return {
      error: result.error.message.includes("Bucket not found")
        ? "ยังไม่มี bucket service-images กรุณารัน migration 20260925_service_images.sql ก่อน"
        : result.error.message,
      publicUrl: null,
    };
  }

  const { data } = supabase.storage.from(serviceImagesBucket).getPublicUrl(uploadPath);
  return { error: null, publicUrl: data.publicUrl };
}

function ServiceImagePreview({ imageUrl, label }: { imageUrl: string | null; label: string }) {
  return (
    <img
      alt={label}
      className="h-28 w-full rounded-lg border border-[var(--line)] bg-slate-50 object-cover"
      src={imageUrl || serviceImagePlaceholder}
    />
  );
}

function validateServiceInput(input: AdminServiceUpdateInput) {
  if (!Number.isFinite(input.base_price) || input.base_price < 0) {
    return "ราคาเริ่มต้นต้องเป็น 0 หรือมากกว่า";
  }

  if (
    !Number.isFinite(input.estimated_duration_minutes) ||
    input.estimated_duration_minutes < 1
  ) {
    return "เวลาโดยประมาณต้องอย่างน้อย 1 นาที";
  }

  if (!input.service_category_id) {
    return "กรุณาเลือกหมวดหมู่";
  }

  return null;
}

function validateServiceCreateInput(input: AdminServiceCreateInput) {
  if (!input.name.trim()) {
    return "กรุณากรอกชื่อบริการ";
  }

  return validateServiceInput(input);
}

function AddServiceForm({
  categories,
  createState,
  onCreate,
}: {
  categories: AdminServiceCategory[];
  createState: CreateState;
  onCreate: (input: AdminServiceCreateInput, imageFile: File | null) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [basePrice, setBasePrice] = useState("0");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [status, setStatus] = useState<AdminService["status"]>("active");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const isCreating = createState.status === "creating";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({
      base_price: Number(basePrice),
      description: description.trim() || null,
      estimated_duration_minutes: Number(durationMinutes),
      name: name.trim(),
      service_category_id: categoryId,
      status,
      image_url: null,
    }, imageFile);
  }

  return (
    <section className="mb-5 rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="border-b border-[var(--line)] pb-4">
        <p className="text-sm font-semibold text-[var(--brand)]">
          เพิ่มบริการ
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          บริการใหม่จะแสดงในหน้าจองของลูกค้าเมื่อเปิดใช้งาน
        </p>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            ชื่อบริการ
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setName(event.target.value)}
              placeholder="เช่น เติมน้ำยาแอร์"
              value={name}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            หมวดหมู่
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setCategoryId(event.target.value)}
              value={categoryId}
            >
              {categories.length === 0 ? (
                <option value="">ไม่มีหมวดหมู่ให้เลือก</option>
              ) : null}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          รายละเอียด
          <textarea
            className="mt-2 min-h-20 w-full resize-y rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="คำอธิบายสั้นๆ ที่แสดงในหน้าจองของลูกค้า"
            value={description}
          />
        </label>

        <div>
          <label className="text-sm font-semibold text-[var(--foreground)]">
            รูปบริการ
            <input
              accept="image/png,image/jpeg,image/webp"
              className="mt-2 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <p className="mt-1 text-xs text-[var(--muted)]">PNG, JPG, WEBP ไม่เกิน 2 MB</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3 md:items-end">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            ราคาเริ่มต้น (บาท)
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              min={0}
              onChange={(event) => setBasePrice(event.target.value)}
              type="number"
              value={basePrice}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            เวลาโดยประมาณ (นาที)
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              min={1}
              onChange={(event) => setDurationMinutes(event.target.value)}
              type="number"
              value={durationMinutes}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            สถานะ
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) =>
                setStatus(event.target.value as AdminService["status"])
              }
              value={status}
            >
              <option value="active">เปิดใช้งาน</option>
              <option value="inactive">ปิดใช้งาน</option>
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating || categories.length === 0}
            type="submit"
          >
            {isCreating ? "กำลังเพิ่ม..." : "เพิ่มบริการ"}
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

function AdminServiceRow({
  actionState,
  categories,
  onDelete,
  onSave,
  service,
}: {
  actionState: ActionState;
  categories: AdminServiceCategory[];
  onDelete: (service: AdminService) => void;
  onSave: (service: AdminService, input: AdminServiceUpdateInput, imageFile: File | null) => void;
  service: AdminService;
}) {
  const [categoryId, setCategoryId] = useState(service.service_category_id);
  const [basePrice, setBasePrice] = useState(String(service.base_price));
  const [durationMinutes, setDurationMinutes] = useState(
    String(service.estimated_duration_minutes),
  );
  const [status, setStatus] = useState<AdminService["status"]>(service.status);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(service.image_url);
  const isSaving =
    actionState.status === "saving" && actionState.serviceId === service.id;
  const isDeleting =
    actionState.status === "deleting" && actionState.serviceId === service.id;
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const hasChanges =
    categoryId !== service.service_category_id ||
    Number(basePrice) !== service.base_price ||
    Number(durationMinutes) !== service.estimated_duration_minutes ||
    status !== service.status || imageFile !== null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(service, {
      base_price: Number(basePrice),
      estimated_duration_minutes: Number(durationMinutes),
      service_category_id: categoryId,
        status,
      image_url: service.image_url,
    }, imageFile);
  }

  function handleDeleteClick() {
    setIsConfirmOpen(true);
  }

  function handleConfirmDelete() {
    setIsConfirmOpen(false);
    onDelete(service);
  }

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="mb-3 flex justify-end">
        <button
          aria-label="ลบบริการ"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving || isDeleting}
          onClick={handleDeleteClick}
          title="ลบบริการ"
          type="button"
        >
          {isDeleting ? (
            <span className="text-xs">...</span>
          ) : (
            <svg
              aria-hidden="true"
              fill="none"
              height="18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="18"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          )}
        </button>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-[180px_1fr]">
        <ServiceImagePreview imageUrl={imagePreview} label={service.name} />
        <label className="self-center text-sm font-semibold text-[var(--foreground)]">
          เปลี่ยนรูปบริการ
          <input
            accept="image/png,image/jpeg,image/webp"
            className="mt-2 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setImageFile(file);
              if (file) setImagePreview(URL.createObjectURL(file));
            }}
            type="file"
          />
          <span className="mt-1 block text-xs font-normal text-[var(--muted)]">PNG, JPG, WEBP ไม่เกิน 2 MB</span>
        </label>
      </div>
      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">
              {service.category?.name ?? "ไม่มีหมวดหมู่"}
            </p>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                service.status,
              )}`}
            >
              {recordStatusLabel(service.status)}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {service.name}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {service.description ?? "-"}
          </p>
        </div>

        <div className="text-sm text-[var(--muted)] lg:text-right">
          <p className="font-semibold text-[var(--foreground)]">
            {currencyFormatter.format(service.base_price)}
          </p>
          <p className="mt-1">{service.estimated_duration_minutes} min</p>
        </div>
      </div>

      <form
        className="mt-4 grid gap-3 md:grid-cols-[minmax(220px,1fr)_140px_160px_140px_minmax(120px,auto)] md:items-end"
        onSubmit={handleSubmit}
      >
        <label className="text-sm font-semibold text-[var(--foreground)]">
          หมวดหมู่
          <select
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setCategoryId(event.target.value)}
            value={categoryId}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.status === "inactive" ? " (ปิดใช้งาน)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          ราคาเริ่มต้น
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            min={0}
            onChange={(event) => setBasePrice(event.target.value)}
            type="number"
            value={basePrice}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          เวลาโดยประมาณ
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            min={1}
            onChange={(event) => setDurationMinutes(event.target.value)}
            type="number"
            value={durationMinutes}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          สถานะ
          <select
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) =>
              setStatus(event.target.value as AdminService["status"])
            }
            value={status}
          >
            <option value="active">เปิดใช้งาน</option>
            <option value="inactive">ปิดใช้งาน</option>
          </select>
        </label>

        <button
          className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!hasChanges || isSaving || isDeleting}
          type="submit"
        >
          {isSaving ? "กำลังบันทึก..." : "บันทึกบริการ"}
        </button>
      </form>

      {actionState.status === "error" &&
      actionState.serviceId === service.id ? (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {actionState.error}
        </p>
      ) : null}

      {actionState.status === "saved" &&
      actionState.serviceId === service.id ? (
        <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-[var(--brand-strong)]">
          {actionState.message}
        </p>
      ) : null}

      <ConfirmDialog
        description={`"${service.name}" จะถูกลบถาวร รวมถึงการจองที่ใช้บริการนี้และข้อมูลที่เกี่ยวข้อง และไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่?`}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        open={isConfirmOpen}
        title="ลบบริการนี้?"
      />
    </article>
  );
}

export function AdminServicesPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    categories: null,
    error: null,
    services: null,
    status: "loading",
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [actionState, setActionState] = useState<ActionState>({
    error: null,
    message: null,
    serviceId: null,
    status: "idle",
  });
  const [createState, setCreateState] = useState<CreateState>({
    error: null,
    message: null,
    status: "idle",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadServices() {
      setLoadState({
        access: null,
        categories: null,
        error: null,
        services: null,
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
          categories: null,
          error: sessionError.message,
          services: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          categories: null,
          error: null,
          services: null,
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
          categories: null,
          error: null,
          services: null,
          status: "access-denied",
        });
        return;
      }

      const [servicesResult, categoriesResult] = await Promise.all([
        getAdminServices(supabase),
        getAdminServiceCategories(supabase),
      ]);

      if (!isMounted) {
        return;
      }

      if (servicesResult.error) {
        setLoadState({
          access: null,
          categories: null,
          error: servicesResult.error.message,
          services: null,
          status: "error",
        });
        return;
      }

      if (categoriesResult.error) {
        setLoadState({
          access: null,
          categories: null,
          error: categoriesResult.error.message,
          services: null,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        categories: categoriesResult.data ?? [],
        error: null,
        services: servicesResult.data ?? [],
        status: "ready",
      });
    }

    void loadServices();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadServices();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const filteredServices = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    const normalizedSearch = searchInput.trim().toLowerCase();

    return loadState.services.filter((service) => {
      const matchesStatus =
        statusFilter === "all" || service.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        service.name.toLowerCase().includes(normalizedSearch) ||
        (service.description ?? "").toLowerCase().includes(normalizedSearch) ||
        (service.category?.name ?? "").toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [loadState, searchInput, statusFilter]);

  async function handleSaveService(
    service: AdminService,
    input: AdminServiceUpdateInput,
    imageFile: File | null,
  ) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateServiceInput(input);

    if (validationError) {
      setActionState({
        error: validationError,
        message: null,
        serviceId: service.id,
        status: "error",
      });
      return;
    }

    setActionState({
      error: null,
      message: null,
      serviceId: service.id,
      status: "saving",
    });

    const supabase = createClient();
    let imageUrl = service.image_url;

    if (imageFile) {
      const upload = await uploadServiceImage(imageFile);
      if (upload.error || !upload.publicUrl) {
        setActionState({ error: upload.error ?? "อัปโหลดรูปไม่สำเร็จ", message: null, serviceId: service.id, status: "error" });
        return;
      }
      imageUrl = upload.publicUrl;
    }

    const { data, error } = await updateAdminService(
      supabase,
      service.id,
      { ...input, image_url: imageUrl },
    );

    if (error) {
      setActionState({
        error: error.message,
        message: null,
        serviceId: service.id,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      services: loadState.services.map((currentService) =>
        currentService.id === service.id
          ? {
              ...currentService,
              base_price: data.base_price,
              image_url: data.image_url,
              estimated_duration_minutes: data.estimated_duration_minutes,
              service_category_id: data.service_category_id,
              category:
                loadState.categories.find(
                  (category) => category.id === data.service_category_id,
                ) ?? null,
              status: data.status,
              updated_at: data.updated_at,
            }
          : currentService,
      ),
    });
    setActionState({
      error: null,
      message: "บันทึกบริการเรียบร้อยแล้ว",
      serviceId: service.id,
      status: "saved",
    });
  }

  async function handleCreateService(input: AdminServiceCreateInput, imageFile: File | null) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateServiceCreateInput(input);

    if (validationError) {
      setCreateState({
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    setCreateState({
      error: null,
      message: null,
      status: "creating",
    });

    const supabase = createClient();
    let imageUrl: string | null = null;

    if (imageFile) {
      const upload = await uploadServiceImage(imageFile);
      if (upload.error || !upload.publicUrl) {
        setCreateState({ error: upload.error ?? "อัปโหลดรูปไม่สำเร็จ", message: null, status: "error" });
        return;
      }
      imageUrl = upload.publicUrl;
    }

    const { data, error } = await createAdminService(supabase, { ...input, image_url: imageUrl });

    if (error) {
      setCreateState({
        error: error.message,
        message: null,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      services: [
        ...loadState.services,
        {
          ...data,
          category:
            loadState.categories.find(
              (category) => category.id === data.service_category_id,
            ) ?? null,
        },
      ].sort((a, b) => a.name.localeCompare(b.name, "th")),
    });
    setCreateState({
      error: null,
      message: "เพิ่มบริการเรียบร้อยแล้ว",
      status: "created",
    });
  }

  async function handleDeleteService(service: AdminService) {
    if (loadState.status !== "ready") {
      return;
    }

    setActionState({
      error: null,
      message: null,
      serviceId: service.id,
      status: "deleting",
    });

    const supabase = createClient();
    const { error } = await deleteAdminService(supabase, service.id);

    if (error) {
      setActionState({
        error: getAdminDeleteErrorMessage(error, "บริการ"),
        message: null,
        serviceId: service.id,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      services: loadState.services.filter(
        (current) => current.id !== service.id,
      ),
    });
    setActionState({
      error: null,
      message: null,
      serviceId: null,
      status: "idle",
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              บริการ
            </h1>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin"
          >
            กลับแดชบอร์ด
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดบริการ...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">กรุณาเข้าสู่ระบบ</p>
            <p className="mt-1">กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "access-denied" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            <p className="text-lg font-bold">ไม่มีสิทธิ์เข้าถึง</p>
            <p className="mt-2">{loadState.access.reason}</p>
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
          <AddServiceForm
            categories={loadState.categories}
            createState={createState}
            key={loadState.services.length}
            onCreate={handleCreateService}
          />

          <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {filteredServices.length} จาก {loadState.services.length}{" "}
                services
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                บริการที่ปิดใช้งานจะไม่แสดงในหน้าจองของลูกค้า
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl">
              <input
                className="min-h-10 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="ค้นหาบริการหรือหมวดบริการ"
                type="search"
                value={searchInput}
              />
              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                {statusFilters.map((status) => (
                  <button
                    className={
                      statusFilter === status
                        ? "min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                        : "min-h-10 shrink-0 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                    }
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    type="button"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredServices.length > 0 ? (
            <div className="mt-5 space-y-4">
              {filteredServices.map((service) => (
                <AdminServiceRow
                  actionState={actionState}
                  categories={loadState.categories}
                  key={service.id}
                  onDelete={handleDeleteService}
                  onSave={handleSaveService}
                  service={service}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบบริการที่ตรงกับตัวกรอง
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
