"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  checkAdminAccess,
  createAdminService,
  deleteAdminService,
  getAdminDeleteErrorMessage,
  getAdminServiceCategories,
  getAdminServices,
  updateAdminService,
  type AdminService,
  type AdminServiceCategory,
  type AdminServiceCreateInput,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";
import { blockNonDecimalKeys, blockNonNumericKeys } from "@/lib/validation";
import {
  AdminActiveSwitch,
  AdminEmptyState,
  AdminFilterBar,
  AdminIcon,
  AdminIconButton,
  AdminLoadMessage,
  AdminModal,
  AdminPageIntro,
  AdminPill,
  AdminToast,
  adminInputClass,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminTextareaClass,
} from "./admin-list-ui";

type LoadState =
  | { status: "loading" | "signed-out"; message: null; services: null; categories: null }
  | { status: "access-denied" | "error"; message: string; services: null; categories: null }
  | { status: "ready"; message: null; services: AdminService[]; categories: AdminServiceCategory[] };

type StatusFilter = "all" | "active" | "inactive";
type EditorState = { mode: "create" } | { mode: "edit"; service: AdminService } | null;

const serviceImagesBucket = "service-images";
const serviceImagePlaceholder = "/service-placeholder.svg";

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ชม. ${rest} นาที` : `${hours} ชม.`;
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

function validateServiceInput(input: AdminServiceCreateInput) {
  if (!input.name.trim()) return "กรุณากรอกชื่อบริการ";
  if (!input.service_category_id) return "กรุณาเลือกหมวดหมู่";
  if (!Number.isFinite(input.base_price) || input.base_price < 0) return "ราคาเริ่มต้นต้องเป็น 0 หรือมากกว่า";
  if (!Number.isFinite(input.estimated_duration_minutes) || input.estimated_duration_minutes < 1) return "เวลาโดยประมาณต้องอย่างน้อย 1 นาที";
  return null;
}

function ServiceEditor({
  categories,
  editor,
  error,
  onClose,
  onSubmit,
  saving,
}: {
  categories: AdminServiceCategory[];
  editor: Exclude<EditorState, null>;
  error: string;
  onClose: () => void;
  onSubmit: (input: AdminServiceCreateInput, imageFile: File | null) => void;
  saving: boolean;
}) {
  const initial = editor.mode === "edit" ? editor.service : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.service_category_id ?? categories[0]?.id ?? "");
  const [basePrice, setBasePrice] = useState(String(initial?.base_price ?? 0));
  const [duration, setDuration] = useState(String(initial?.estimated_duration_minutes ?? 30));
  const [active, setActive] = useState((initial?.status ?? "active") === "active");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial?.image_url ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // ล้าง object URL ของรูปตัวอย่างเมื่อปิดหน้าต่าง
  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  function pickImage(file: File | null) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = file ? URL.createObjectURL(file) : null;
    setImageFile(file);
    setPreviewUrl(objectUrlRef.current ?? initial?.image_url ?? null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      service_category_id: categoryId,
      base_price: Number(basePrice),
      estimated_duration_minutes: Number(duration),
      status: active ? "active" : "inactive",
      image_url: initial?.image_url ?? null,
    }, imageFile);
  }

  return (
    <AdminModal
      footer={
        <>
          <button className={adminSecondaryButtonClass} onClick={onClose} type="button">ยกเลิก</button>
          <button className={adminPrimaryButtonClass} disabled={saving || !name.trim() || categories.length === 0} form="service-editor" type="submit">
            {saving ? "กำลังบันทึก..." : editor.mode === "create" ? "เพิ่มบริการ" : "บันทึกการแก้ไข"}
          </button>
        </>
      }
      onClose={onClose}
      open
      size="lg"
      title={editor.mode === "create" ? "เพิ่มบริการใหม่" : "แก้ไขบริการ"}
    >
      <form className="space-y-4" id="service-editor" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="sm:w-48">
            <p className={adminLabelClass}>รูปบริการ</p>
            <button
              className="group relative mt-1.5 block aspect-[4/3] w-full overflow-hidden rounded-xl border border-dashed border-[var(--line)] bg-slate-50"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก Supabase storage หรือ blob ที่เพิ่งเลือก */}
              <img alt="ตัวอย่างรูปบริการ" className="h-full w-full object-cover" src={previewUrl || serviceImagePlaceholder} />
              <span className="absolute inset-0 grid place-items-center bg-slate-900/45 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100">
                {previewUrl ? "เปลี่ยนรูป" : "เลือกรูป"}
              </span>
            </button>
            <input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => pickImage(event.target.files?.[0] ?? null)} ref={fileInputRef} type="file" />
            <p className="mt-1.5 text-xs text-[var(--muted)]">{imageFile ? imageFile.name : "PNG, JPG, WEBP ไม่เกิน 2 MB"}</p>
          </div>

          <div className="flex-1 space-y-4">
            <label className={adminLabelClass}>
              ชื่อบริการ
              <input className={adminInputClass} onChange={(event) => setName(event.target.value)} placeholder="เช่น เติมน้ำยาแอร์" value={name} />
            </label>
            <label className={adminLabelClass}>
              หมวดหมู่
              <select className={adminInputClass} onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
                {categories.length === 0 ? <option value="">ยังไม่มีหมวดหมู่ เพิ่มที่หน้าหมวดบริการก่อน</option> : null}
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}{category.status === "active" ? "" : " (ปิดใช้งาน)"}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <label className={adminLabelClass}>
          รายละเอียด <span className="font-normal text-[var(--muted)]">(ไม่บังคับ)</span>
          <textarea className={adminTextareaClass} onChange={(event) => setDescription(event.target.value)} placeholder="คำอธิบายสั้น ๆ ที่แสดงในหน้าจองของลูกค้า" value={description} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={adminLabelClass}>
            ราคาเริ่มต้น (บาท)
            <input className={adminInputClass} inputMode="decimal" min={0} onChange={(event) => setBasePrice(event.target.value)} onKeyDown={blockNonDecimalKeys} step="0.01" type="number" value={basePrice} />
          </label>
          <label className={adminLabelClass}>
            เวลาโดยประมาณ (นาที)
            <input className={adminInputClass} inputMode="numeric" min={1} onChange={(event) => setDuration(event.target.value)} onKeyDown={blockNonNumericKeys} type="number" value={duration} />
          </label>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">แสดงให้ลูกค้าจอง</p>
            <p className="text-xs text-[var(--muted)]">ปิดไว้ถ้ายังไม่เปิดให้บริการนี้</p>
          </div>
          <AdminActiveSwitch active={active} label="แสดงให้ลูกค้าจอง" onToggle={() => setActive((value) => !value)} />
        </div>

        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      </form>
    </AdminModal>
  );
}

function ServiceCard({
  onDelete,
  onEdit,
  onToggle,
  service,
  toggling,
}: {
  onDelete: () => void;
  onEdit: () => void;
  onToggle: () => void;
  service: AdminService;
  toggling: boolean;
}) {
  const isActive = service.status === "active";
  return (
    <article className={`group flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${isActive ? "" : "opacity-75"}`}>
      <button className="relative block aspect-[16/10] overflow-hidden bg-slate-100" onClick={onEdit} type="button" aria-label={`แก้ไข ${service.name}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก Supabase storage */}
        <img alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={service.image_url || serviceImagePlaceholder} />
        <span className="absolute left-3 top-3">
          {isActive ? <AdminPill tone="green">เปิดให้จอง</AdminPill> : <AdminPill tone="gray">ปิดใช้งาน</AdminPill>}
        </span>
      </button>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold text-[var(--brand)]">{service.category?.name ?? "ไม่มีหมวดหมู่"}</p>
        <h3 className="mt-1 font-bold text-[var(--foreground)]">{service.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{service.description || "ไม่มีรายละเอียด"}</p>
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span className="font-bold text-[var(--foreground)]">{currencyFormatter.format(service.base_price)}</span>
          <span className="inline-flex items-center gap-1 text-[var(--muted)]"><AdminIcon name="clock" className="h-3.5 w-3.5" />{formatDuration(service.estimated_duration_minutes)}</span>
        </div>
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
            <AdminActiveSwitch active={isActive} disabled={toggling} label={`เปิด/ปิดให้จอง ${service.name}`} onToggle={onToggle} />
            <div className="flex items-center gap-1">
              <AdminIconButton icon="edit" label={`แก้ไข ${service.name}`} onClick={onEdit} />
              <AdminIconButton icon="trash" label={`ลบ ${service.name}`} onClick={onDelete} tone="danger" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function AdminServicesPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", message: null, services: null, categories: null });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editor, setEditor] = useState<EditorState>(null);
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminService | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadServices() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) return setLoadState({ status: "error", message: sessionError.message, services: null, categories: null });
      if (!session?.user) return setLoadState({ status: "signed-out", message: null, services: null, categories: null });

      const access = await checkAdminAccess(supabase, session.user.id);
      if (!isMounted) return;
      if (!access.allowed) return setLoadState({ status: "access-denied", message: access.reason, services: null, categories: null });

      const [servicesResult, categoriesResult] = await Promise.all([getAdminServices(supabase), getAdminServiceCategories(supabase)]);
      if (!isMounted) return;
      const error = servicesResult.error ?? categoriesResult.error;
      if (error) return setLoadState({ status: "error", message: error.message, services: null, categories: null });
      setLoadState({ status: "ready", message: null, services: servicesResult.data ?? [], categories: categoriesResult.data ?? [] });
    }

    void loadServices();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void loadServices(); });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const services = useMemo(() => (loadState.status === "ready" ? loadState.services : []), [loadState]);
  const categories = useMemo(() => (loadState.status === "ready" ? loadState.categories : []), [loadState]);
  const activeCount = services.filter((service) => service.status === "active").length;

  const filteredServices = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return services.filter((service) =>
      (statusFilter === "all" || service.status === statusFilter) &&
      (categoryFilter === "all" || service.service_category_id === categoryFilter) &&
      (!keyword ||
        service.name.toLowerCase().includes(keyword) ||
        (service.description ?? "").toLowerCase().includes(keyword) ||
        (service.category?.name ?? "").toLowerCase().includes(keyword)),
    );
  }, [services, search, statusFilter, categoryFilter]);

  function withCategory(service: Omit<AdminService, "category">): AdminService {
    return { ...service, category: categories.find((category) => category.id === service.service_category_id) ?? null };
  }

  function replaceServices(next: AdminService[]) {
    if (loadState.status === "ready") setLoadState({ ...loadState, services: next });
  }

  function openEditor(next: EditorState) {
    setEditorError("");
    setEditor(next);
  }

  async function handleSubmit(input: AdminServiceCreateInput, imageFile: File | null) {
    if (!editor) return;
    const validationError = validateServiceInput(input);
    if (validationError) return setEditorError(validationError);

    setSaving(true);
    setEditorError("");
    let imageUrl = input.image_url;
    if (imageFile) {
      const upload = await uploadServiceImage(imageFile);
      if (upload.error || !upload.publicUrl) {
        setSaving(false);
        return setEditorError(upload.error ?? "อัปโหลดรูปไม่สำเร็จ");
      }
      imageUrl = upload.publicUrl;
    }

    const supabase = createClient();
    const { data, error } = editor.mode === "create"
      ? await createAdminService(supabase, { ...input, image_url: imageUrl })
      : await updateAdminService(supabase, editor.service.id, { ...input, image_url: imageUrl });
    setSaving(false);
    if (error || !data) return setEditorError(error?.message ?? "บันทึกไม่สำเร็จ");

    const saved = withCategory(data);
    replaceServices(
      editor.mode === "create"
        ? [...services, saved].sort((a, b) => a.name.localeCompare(b.name, "th"))
        : services.map((service) => (service.id === saved.id ? saved : service)),
    );
    setEditor(null);
    setToast({ message: editor.mode === "create" ? `เพิ่มบริการ "${saved.name}" แล้ว` : `บันทึก "${saved.name}" แล้ว`, tone: "success" });
  }

  async function handleToggle(service: AdminService) {
    setTogglingId(service.id);
    const { data, error } = await updateAdminService(createClient(), service.id, {
      base_price: service.base_price,
      estimated_duration_minutes: service.estimated_duration_minutes,
      image_url: service.image_url,
      service_category_id: service.service_category_id,
      status: service.status === "active" ? "inactive" : "active",
    });
    setTogglingId(null);
    if (error || !data) return setToast({ message: error?.message ?? "เปลี่ยนสถานะไม่สำเร็จ", tone: "error" });
    const saved = withCategory(data);
    replaceServices(services.map((current) => (current.id === saved.id ? saved : current)));
    setToast({ message: `${saved.status === "active" ? "เปิด" : "ปิด"}ให้จอง "${saved.name}" แล้ว`, tone: "success" });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteAdminService(createClient(), deleteTarget.id);
    setDeleting(false);
    const target = deleteTarget;
    setDeleteTarget(null);
    if (error) return setToast({ message: getAdminDeleteErrorMessage(error, "บริการ"), tone: "error" });
    replaceServices(services.filter((service) => service.id !== target.id));
    setToast({ message: `ลบ "${target.name}" แล้ว`, tone: "success" });
  }

  const addButton = (
    <button className={adminPrimaryButtonClass} onClick={() => openEditor({ mode: "create" })} type="button">
      <AdminIcon name="plus" /> เพิ่มบริการ
    </button>
  );

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {loadState.status !== "ready" ? (
        <AdminLoadMessage loadingLabel="กำลังโหลดบริการ..." message={loadState.message} status={loadState.status} />
      ) : (
        <>
          <AdminPageIntro action={addButton} description="บริการที่เปิดให้จองจะแสดงในหน้าจองคิวของลูกค้า กดที่การ์ดเพื่อแก้ไข" />

          <AdminFilterBar
            filter={statusFilter}
            filters={[
              { value: "all", label: "ทั้งหมด", count: services.length },
              { value: "active", label: "เปิดให้จอง", count: activeCount },
              { value: "inactive", label: "ปิดใช้งาน", count: services.length - activeCount },
            ]}
            onFilterChange={setStatusFilter}
            onSearchChange={setSearch}
            search={search}
            searchPlaceholder="ค้นหาชื่อบริการหรือหมวดหมู่"
            trailing={
              <select aria-label="กรองตามหมวดหมู่" className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--foreground)] lg:w-48" onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
                <option value="all">ทุกหมวดหมู่</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            }
          />

          {filteredServices.length === 0 ? (
            <AdminEmptyState
              action={services.length === 0 ? addButton : undefined}
              description={services.length === 0 ? "เพิ่มบริการแรกเพื่อให้ลูกค้าเริ่มจองคิวได้" : "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"}
              title={services.length === 0 ? "ยังไม่มีบริการ" : "ไม่พบบริการที่ค้นหา"}
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  onDelete={() => setDeleteTarget(service)}
                  onEdit={() => openEditor({ mode: "edit", service })}
                  onToggle={() => void handleToggle(service)}
                  service={service}
                  toggling={togglingId === service.id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editor ? (
        <ServiceEditor
          categories={categories}
          editor={editor}
          error={editorError}
          key={editor.mode === "edit" ? editor.service.id : "create"}
          onClose={() => setEditor(null)}
          onSubmit={(input, imageFile) => void handleSubmit(input, imageFile)}
          saving={saving}
        />
      ) : null}

      <ConfirmDialog
        description={deleteTarget ? `"${deleteTarget.name}" จะถูกลบถาวร รวมถึงการจองที่ใช้บริการนี้และข้อมูลที่เกี่ยวข้อง และไม่สามารถกู้คืนได้ ถ้าแค่ไม่อยากให้ลูกค้าจอง ให้ปิดใช้งานแทน` : ""}
        isLoading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        open={deleteTarget !== null}
        title="ลบบริการนี้?"
      />

      <AdminToast message={toast?.message ?? null} onDone={clearToast} tone={toast?.tone} />
    </main>
  );
}
