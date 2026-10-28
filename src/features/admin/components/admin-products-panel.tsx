"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  checkAdminAccess,
  createAdminProduct,
  deleteAdminProduct,
  getAdminDeleteErrorMessage,
  getAdminProductCategories,
  getAdminProducts,
  updateAdminProduct,
  type AdminProduct,
  type AdminProductCategory,
  type AdminProductUpdateInput,
} from "@/features/admin";
import { ProductImageThumb } from "@/features/products/components/product-image-thumb";
import { createClient } from "@/lib/supabase/browser";
import { LOW_STOCK_THRESHOLD } from "./admin-inventory-panel";
import { blockNonDecimalKeys } from "@/lib/validation";
import {
  AdminActiveSwitch,
  AdminEmptyState,
  AdminFilterBar,
  AdminIcon,
  AdminLoadMessage,
  AdminModal,
  AdminPageIntro,
  AdminPill,
  AdminStatCard,
  AdminToast,
  adminDarkButtonClass,
  adminInputClass,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminTextareaClass,
} from "./admin-list-ui";

type LoadState =
  | { status: "loading" | "signed-out"; message: null; products: null; categories: null }
  | { status: "access-denied" | "error"; message: string; products: null; categories: null }
  | { status: "ready"; message: null; products: AdminProduct[]; categories: AdminProductCategory[] };

type StatusFilter = "all" | "active" | "inactive";
type EditorState = { mode: "create" } | { mode: "edit"; product: AdminProduct } | null;

const productImagesBucket = "product-images";
const productImagePlaceholder = "/product-placeholder.svg";

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function validateProductInput(input: AdminProductUpdateInput) {
  if (!input.name) return "กรุณากรอกชื่อสินค้า";
  if (!input.product_category_id) return "กรุณาเลือกหมวดสินค้า";
  if (!Number.isFinite(input.unit_price) || input.unit_price < 1) return "ราคาขายต้องอย่างน้อย 1 บาท";
  if (!Number.isFinite(input.cost_price) || input.cost_price < 0) return "ราคาต้นทุนต้องเป็น 0 หรือมากกว่า";
  return null;
}

function getSafeProductImageExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

async function uploadProductImage(file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return { error: "รองรับเฉพาะไฟล์ PNG, JPG หรือ WEBP", publicUrl: null };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { error: "ไฟล์รูปสินค้าต้องไม่เกิน 2 MB", publicUrl: null };
  }

  const uploadPath = `สินค้า/${Date.now()}-${crypto.randomUUID()}.${getSafeProductImageExtension(file)}`;
  const supabase = createClient();
  const uploadResult = await supabase.storage.from(productImagesBucket).upload(uploadPath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (uploadResult.error) {
    return {
      error: uploadResult.error.message.toLowerCase().includes("bucket")
        ? "ยังไม่มี bucket product-images กรุณารันไฟล์ supabase/product-image-upload.sql ก่อน"
        : uploadResult.error.message,
      publicUrl: null,
    };
  }

  const { data: { publicUrl } } = supabase.storage.from(productImagesBucket).getPublicUrl(uploadPath);
  return { error: null, publicUrl };
}

function stockTone(product: AdminProduct) {
  if (product.stock_quantity <= 0) return "text-[var(--color-safety)]";
  if (product.stock_quantity <= LOW_STOCK_THRESHOLD) return "text-amber-600";
  return "text-[var(--color-signal)]";
}

function ProductEditor({
  categories,
  editor,
  error,
  onClose,
  onDelete,
  onSubmit,
  saving,
}: {
  categories: AdminProductCategory[];
  editor: Exclude<EditorState, null>;
  error: string;
  onClose: () => void;
  onDelete: (product: AdminProduct) => void;
  onSubmit: (input: AdminProductUpdateInput, imageFile: File | null) => void;
  saving: boolean;
}) {
  const initial = editor.mode === "edit" ? editor.product : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [categoryId, setCategoryId] = useState(initial?.product_category_id ?? categories.find((category) => category.status === "active")?.id ?? categories[0]?.id ?? "");
  const [unitPrice, setUnitPrice] = useState(String(initial?.unit_price ?? ""));
  const [costPrice, setCostPrice] = useState(String(initial?.cost_price ?? ""));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState((initial?.status ?? "active") === "active");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial?.image_url ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const price = Number(unitPrice) || 0;
  const cost = Number(costPrice) || 0;
  const margin = price > 0 ? Math.round(((price - cost) / price) * 100) : null;

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
      cost_price: cost,
      description: description.trim() || null,
      image_url: initial?.image_url ?? null,
      name: name.trim(),
      product_category_id: categoryId,
      sku: sku.trim() || null,
      status: active ? "active" : "inactive",
      unit_price: price,
    }, imageFile);
  }

  return (
    <AdminModal
      footer={
        <>
          {initial ? (
            <button className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[var(--color-safety)] hover:bg-red-50 sm:mr-auto" onClick={() => onDelete(initial)} type="button">ลบสินค้า</button>
          ) : null}
          <button className={adminSecondaryButtonClass} onClick={onClose} type="button">ยกเลิก</button>
          <button className={adminPrimaryButtonClass} disabled={saving || !name.trim() || categories.length === 0} form="product-editor" type="submit">
            {saving ? "กำลังบันทึก..." : initial ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}
          </button>
        </>
      }
      onClose={onClose}
      open
      size="lg"
      title={initial ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}
    >
      <form className="space-y-4" id="product-editor" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="sm:w-44">
            <p className={adminLabelClass}>รูปสินค้า</p>
            <button
              className="group relative mt-1.5 block aspect-square w-full overflow-hidden rounded-xl border border-dashed border-[var(--line)] bg-[var(--color-concrete)]"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก Supabase storage หรือ blob ที่เพิ่งเลือก */}
              <img alt="ตัวอย่างรูปสินค้า" className="h-full w-full object-cover" src={previewUrl || productImagePlaceholder} />
              <span className="absolute inset-0 grid place-items-center bg-[var(--color-asphalt)]/45 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100">
                {previewUrl ? "เปลี่ยนรูป" : "เลือกรูป"}
              </span>
            </button>
            <input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => pickImage(event.target.files?.[0] ?? null)} ref={fileInputRef} type="file" />
            <p className="mt-1.5 text-xs text-[var(--muted)]">{imageFile ? imageFile.name : "PNG, JPG, WEBP ไม่เกิน 2 MB"}</p>
          </div>

          <div className="flex-1 space-y-4">
            <label className={adminLabelClass}>
              ชื่อสินค้า
              <input autoFocus className={adminInputClass} onChange={(event) => setName(event.target.value)} placeholder="เช่น น้ำมันเครื่องสังเคราะห์ 5W-30 (4 ลิตร)" value={name} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={adminLabelClass}>
                SKU <span className="font-normal text-[var(--muted)]">(ไม่บังคับ)</span>
                <input className={`${adminInputClass} uppercase`} onChange={(event) => setSku(event.target.value)} placeholder="OIL-5W30-4L" value={sku} />
              </label>
              <label className={adminLabelClass}>
                หมวดสินค้า
                <select className={adminInputClass} onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
                  {categories.length === 0 ? <option value="">ยังไม่มีหมวด เพิ่มที่หน้าหมวดสินค้าก่อน</option> : null}
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}{category.status === "active" ? "" : " (ปิดใช้งาน)"}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={adminLabelClass}>
            ราคาขาย (บาท)
            <input className={adminInputClass} inputMode="decimal" min={1} onChange={(event) => setUnitPrice(event.target.value)} onKeyDown={blockNonDecimalKeys} placeholder="1" required step="0.01" type="number" value={unitPrice} />
          </label>
          <label className={adminLabelClass}>
            ต้นทุน (บาท)
            <input className={adminInputClass} inputMode="decimal" min={0} onChange={(event) => setCostPrice(event.target.value)} onKeyDown={blockNonDecimalKeys} placeholder="0" step="0.01" type="number" value={costPrice} />
          </label>
        </div>
        {margin !== null ? (
          <p className={`-mt-2 text-xs ${margin < 0 ? "text-[var(--color-safety)]" : "text-[var(--muted)]"}`}>
            กำไรต่อชิ้น {currencyFormatter.format(price - cost)} ({margin}%){margin < 0 ? " · ราคาขายต่ำกว่าต้นทุน" : ""}
          </p>
        ) : null}

        <label className={adminLabelClass}>
          รายละเอียด <span className="font-normal text-[var(--muted)]">(ไม่บังคับ)</span>
          <textarea className={adminTextareaClass} onChange={(event) => setDescription(event.target.value)} placeholder="ข้อมูลที่แสดงในหน้าร้านค้าของลูกค้า" value={description} />
        </label>

        <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--color-concrete)] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">เปิดขายในหน้าร้าน</p>
            <p className="text-xs text-[var(--muted)]">
              {initial ? `สต็อกคงเหลือ ${initial.stock_quantity} ชิ้น · ปรับจำนวนที่หน้าคลังสินค้า` : "สต็อกเริ่มต้นเป็น 0 รับสินค้าเข้าที่หน้าคลังสินค้า"}
            </p>
          </div>
          <AdminActiveSwitch active={active} label="เปิดขายในหน้าร้าน" onToggle={() => setActive((value) => !value)} />
        </div>

        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      </form>
    </AdminModal>
  );
}

export function AdminProductsPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", message: null, products: null, categories: null });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editor, setEditor] = useState<EditorState>(null);
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadProducts() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) return setLoadState({ status: "error", message: sessionError.message, products: null, categories: null });
      if (!session?.user) return setLoadState({ status: "signed-out", message: null, products: null, categories: null });

      const access = await checkAdminAccess(supabase, session.user.id);
      if (!isMounted) return;
      if (!access.allowed) return setLoadState({ status: "access-denied", message: access.reason, products: null, categories: null });

      const [productsResult, categoriesResult] = await Promise.all([getAdminProducts(supabase), getAdminProductCategories(supabase)]);
      if (!isMounted) return;
      const error = productsResult.error ?? categoriesResult.error;
      if (error) return setLoadState({ status: "error", message: error.message, products: null, categories: null });
      setLoadState({ status: "ready", message: null, products: productsResult.data ?? [], categories: categoriesResult.data ?? [] });
    }

    void loadProducts();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void loadProducts(); });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const products = useMemo(() => (loadState.status === "ready" ? loadState.products : []), [loadState]);
  const categories = useMemo(() => (loadState.status === "ready" ? loadState.categories : []), [loadState]);
  const activeCount = products.filter((product) => product.status === "active").length;
  const lowStockCount = products.filter((product) => product.status === "active" && product.stock_quantity <= LOW_STOCK_THRESHOLD).length;

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return products.filter((product) =>
      (statusFilter === "all" || product.status === statusFilter) &&
      (categoryFilter === "all" || product.product_category_id === categoryFilter) &&
      (!keyword ||
        product.name.toLowerCase().includes(keyword) ||
        (product.sku ?? "").toLowerCase().includes(keyword) ||
        (product.category?.name ?? "").toLowerCase().includes(keyword)),
    );
  }, [products, search, statusFilter, categoryFilter]);

  function withCategory(product: Omit<AdminProduct, "category">): AdminProduct {
    return { ...product, category: categories.find((category) => category.id === product.product_category_id) ?? null };
  }

  function replaceProducts(next: AdminProduct[]) {
    if (loadState.status === "ready") setLoadState({ ...loadState, products: next });
  }

  function openEditor(next: EditorState) {
    setEditorError("");
    setEditor(next);
  }

  async function handleSubmit(input: AdminProductUpdateInput, imageFile: File | null) {
    if (!editor) return;
    const validationError = validateProductInput(input);
    if (validationError) return setEditorError(validationError);
    const editingId = editor.mode === "edit" ? editor.product.id : null;
    if (input.sku && products.some((product) => product.id !== editingId && product.sku?.toLowerCase() === input.sku?.toLowerCase())) {
      return setEditorError("SKU นี้ถูกใช้กับสินค้าอื่นแล้ว");
    }

    setSaving(true);
    setEditorError("");
    let imageUrl = input.image_url;
    if (imageFile) {
      const upload = await uploadProductImage(imageFile);
      if (upload.error || !upload.publicUrl) {
        setSaving(false);
        return setEditorError(upload.error ?? "อัปโหลดรูปไม่สำเร็จ");
      }
      imageUrl = upload.publicUrl;
    }

    const supabase = createClient();
    const payload = { ...input, image_url: imageUrl };
    const { data, error } = editingId ? await updateAdminProduct(supabase, editingId, payload) : await createAdminProduct(supabase, payload);
    setSaving(false);
    if (error || !data) return setEditorError(error?.message ?? "บันทึกไม่สำเร็จ");

    const saved = withCategory(data);
    replaceProducts(editingId ? products.map((product) => (product.id === saved.id ? saved : product)) : [saved, ...products]);
    setEditor(null);
    setToast({ message: editingId ? `บันทึก "${saved.name}" แล้ว` : `เพิ่มสินค้า "${saved.name}" แล้ว`, tone: "success" });
  }

  async function handleToggle(product: AdminProduct) {
    setTogglingId(product.id);
    const { data, error } = await updateAdminProduct(createClient(), product.id, {
      cost_price: product.cost_price,
      description: product.description,
      image_url: product.image_url,
      name: product.name,
      product_category_id: product.product_category_id,
      sku: product.sku,
      status: product.status === "active" ? "inactive" : "active",
      unit_price: product.unit_price,
    });
    setTogglingId(null);
    if (error || !data) return setToast({ message: error?.message ?? "เปลี่ยนสถานะไม่สำเร็จ", tone: "error" });
    const saved = withCategory(data);
    replaceProducts(products.map((current) => (current.id === saved.id ? saved : current)));
    setToast({ message: `${saved.status === "active" ? "เปิดขาย" : "ปิดขาย"} "${saved.name}" แล้ว`, tone: "success" });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteAdminProduct(createClient(), deleteTarget.id);
    setDeleting(false);
    const target = deleteTarget;
    setDeleteTarget(null);
    if (error) return setToast({ message: getAdminDeleteErrorMessage(error, "สินค้า"), tone: "error" });
    setEditor(null);
    replaceProducts(products.filter((product) => product.id !== target.id));
    setToast({ message: `ลบ "${target.name}" แล้ว`, tone: "success" });
  }

  const addButton = (
    <button className={adminPrimaryButtonClass} onClick={() => openEditor({ mode: "create" })} type="button">
      <AdminIcon name="plus" /> เพิ่มสินค้า
    </button>
  );

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {loadState.status !== "ready" ? (
        <AdminLoadMessage loadingLabel="กำลังโหลดสินค้า..." message={loadState.message} status={loadState.status} />
      ) : (
        <>
          <AdminPageIntro
            action={
              <>
                {addButton}
                <Link className={adminDarkButtonClass} href="/admin/inventory">จัดการคลังสินค้า</Link>
                <Link className={adminSecondaryButtonClass} href="/admin/inventory-review">ตรวจสต็อก</Link>
              </>
            }
            description="จัดการรายละเอียดสินค้า SKU ราคา ต้นทุน สถานะการขาย และจำนวนสต็อกปัจจุบัน"
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <AdminStatCard highlight label="สินค้าทั้งหมด" value={products.length} />
            <AdminStatCard label="สินค้าที่เปิดขาย" value={activeCount} />
            <AdminStatCard label="สต็อกใกล้หมด" value={lowStockCount} />
          </div>

          <AdminFilterBar
            filter={statusFilter}
            filters={[
              { value: "all", label: "ทั้งหมด", count: products.length },
              { value: "active", label: "เปิดขาย", count: activeCount },
              { value: "inactive", label: "ปิดใช้งาน", count: products.length - activeCount },
            ]}
            onFilterChange={setStatusFilter}
            onSearchChange={setSearch}
            search={search}
            searchPlaceholder="ค้นหาชื่อสินค้า SKU หรือหมวดสินค้า"
            trailing={
              <select aria-label="กรองตามหมวดสินค้า" className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--foreground)] lg:w-48" onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
                <option value="all">ทุกหมวดสินค้า</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            }
          />

          {filtered.length === 0 ? (
            <AdminEmptyState
              action={products.length === 0 ? addButton : undefined}
              description={products.length === 0 ? "เพิ่มสินค้าแรกเพื่อเริ่มขายในหน้าร้าน" : "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"}
              title={products.length === 0 ? "ยังไม่มีสินค้า" : "ไม่พบสินค้าที่ค้นหา"}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                  <thead className="bg-[var(--color-asphalt)] text-xs font-semibold text-white">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold" scope="col">สินค้า</th>
                      <th className="px-3 py-3.5 font-semibold" scope="col">หมวดสินค้า</th>
                      <th className="px-3 py-3.5 text-right font-semibold" scope="col">ราคาขาย</th>
                      <th className="px-3 py-3.5 text-right font-semibold" scope="col">ต้นทุน</th>
                      <th className="px-3 py-3.5 text-right font-semibold" scope="col">สต็อก</th>
                      <th className="px-3 py-3.5 font-semibold" scope="col">สถานะ</th>
                      <th className="px-5 py-3.5 text-right font-semibold" scope="col"><span className="sr-only">แก้ไข</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((product) => {
                      const isActive = product.status === "active";
                      return (
                        <tr className={`border-t border-[var(--line)] transition hover:bg-[var(--color-concrete)] ${isActive ? "" : "bg-[var(--color-concrete)]/60"}`} key={product.id}>
                          <td className="px-5 py-3">
                            <button className="flex items-center gap-3.5 text-left" onClick={() => openEditor({ mode: "edit", product })} type="button">
                              <ProductImageThumb alt={`รูปสินค้า ${product.name}`} className={`!rounded-xl ${isActive ? "" : "opacity-60 grayscale"}`} size="sm" src={product.image_url} />
                              <span className="min-w-0">
                                <span className="block font-semibold text-[var(--foreground)] hover:text-[var(--color-safety)]">{product.name}</span>
                                <span className="mt-0.5 block text-xs text-[var(--muted)]">{product.sku ? `SKU ${product.sku}` : "ไม่มี SKU"}</span>
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-3 text-[var(--color-steel)]">{product.category?.name ?? "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-[var(--foreground)]">{currencyFormatter.format(product.unit_price)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-[var(--muted)]">{currencyFormatter.format(product.cost_price)}</td>
                          <td className={`whitespace-nowrap px-3 py-3 text-right text-base font-bold ${stockTone(product)}`}>{product.stock_quantity}</td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <span className="flex items-center gap-2.5">
                              <AdminActiveSwitch active={isActive} disabled={togglingId === product.id} label={`เปิด/ปิดขาย ${product.name}`} onToggle={() => void handleToggle(product)} />
                              {isActive ? <AdminPill tone="done">เปิดขาย</AdminPill> : <AdminPill tone="muted">ปิดใช้งาน</AdminPill>}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[var(--color-asphalt)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-asphalt-2)]" onClick={() => openEditor({ mode: "edit", product })} type="button">
                              <AdminIcon name="edit" className="h-3.5 w-3.5" /> แก้ไข
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {editor ? (
        <ProductEditor
          categories={categories}
          editor={editor}
          error={editorError}
          key={editor.mode === "edit" ? editor.product.id : "create"}
          onClose={() => setEditor(null)}
          onDelete={setDeleteTarget}
          onSubmit={(input, imageFile) => void handleSubmit(input, imageFile)}
          saving={saving}
        />
      ) : null}

      <ConfirmDialog
        description={deleteTarget ? `"${deleteTarget.name}" จะถูกลบถาวรและไม่สามารถกู้คืนได้ ถ้าแค่ไม่อยากให้ลูกค้าเห็น ให้ปิดขายแทน` : ""}
        isLoading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        open={deleteTarget !== null}
        title="ลบสินค้านี้?"
      />

      <AdminToast message={toast?.message ?? null} onDone={clearToast} tone={toast?.tone} />
    </main>
  );
}
