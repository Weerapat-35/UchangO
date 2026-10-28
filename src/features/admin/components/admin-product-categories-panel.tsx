"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  checkAdminAccess,
  createAdminProductCategory,
  deleteAdminProductCategory,
  getAdminDeleteErrorMessage,
  getAdminProductCategories,
  getAdminProducts,
  updateAdminProductCategory,
  type AdminProduct,
  type AdminProductCategory,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";
import {
  AdminActiveSwitch,
  AdminEmptyState,
  AdminIcon,
  AdminLoadMessage,
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
  | { status: "loading" | "signed-out"; message: null; categories: null; products: null }
  | { status: "access-denied" | "error"; message: string; categories: null; products: null }
  | { status: "ready"; message: null; categories: AdminProductCategory[]; products: AdminProduct[] };

function CategoryForm({
  category,
  error,
  onCancel,
  onDelete,
  onSubmit,
  saving,
}: {
  category: AdminProductCategory | null;
  error: string;
  onCancel: () => void;
  onDelete: (category: AdminProductCategory) => void;
  onSubmit: (input: { name: string; description: string | null; status: string }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [active, setActive] = useState((category?.status ?? "active") === "active");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ name: name.trim(), description: description.trim() || null, status: active ? "active" : "inactive" });
  }

  return (
    <section className={`rounded-2xl border bg-white p-5 shadow-sm lg:sticky lg:top-24 ${category ? "border-[var(--color-safety)]/40 ring-4 ring-red-50" : "border-[var(--line)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--foreground)]">{category ? "แก้ไขหมวดสินค้า" : "เพิ่มหมวดสินค้า"}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{category ? `กำลังแก้ไข "${category.name}"` : "หมวดใหม่จะเลือกได้ทันทีในหน้าสินค้า"}</p>
        </div>
        {category ? (
          <button aria-label="ยกเลิกการแก้ไข" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--color-concrete-2)]" onClick={onCancel} type="button">
            <AdminIcon name="close" />
          </button>
        ) : null}
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <label className={adminLabelClass}>
          ชื่อหมวดสินค้า
          <input className={adminInputClass} onChange={(event) => setName(event.target.value)} placeholder="เช่น น้ำมันเครื่อง" value={name} />
        </label>
        <label className={adminLabelClass}>
          รายละเอียด <span className="font-normal text-[var(--muted)]">(ไม่บังคับ)</span>
          <textarea className={adminTextareaClass} onChange={(event) => setDescription(event.target.value)} placeholder="คำอธิบายสั้น ๆ เช่น น้ำมันเครื่องและน้ำมันเกียร์" value={description} />
        </label>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--color-concrete)] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">เปิดใช้งาน</p>
            <p className="text-xs text-[var(--muted)]">หมวดที่ปิดจะไม่แสดงในหน้าร้าน</p>
          </div>
          <AdminActiveSwitch active={active} label="เปิดใช้งาน" onToggle={() => setActive((value) => !value)} />
        </div>

        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <button className={`${adminPrimaryButtonClass} w-full`} disabled={saving || !name.trim()} type="submit">
          {saving ? "กำลังบันทึก..." : category ? "บันทึกการแก้ไข" : <><AdminIcon name="plus" /> เพิ่มหมวดสินค้า</>}
        </button>
        {category ? (
          <div className="flex gap-2">
            <button className={`${adminSecondaryButtonClass} flex-1`} onClick={onCancel} type="button">ยกเลิก</button>
            <button className="min-h-11 flex-1 rounded-xl text-sm font-semibold text-[var(--color-safety)] hover:bg-red-50" onClick={() => onDelete(category)} type="button">ลบหมวดนี้</button>
          </div>
        ) : null}
      </form>
    </section>
  );
}

export function AdminProductCategoriesPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", message: null, categories: null, products: null });
  const [editing, setEditing] = useState<AdminProductCategory | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminProductCategory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadCategories() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) return setLoadState({ status: "error", message: sessionError.message, categories: null, products: null });
      if (!session?.user) return setLoadState({ status: "signed-out", message: null, categories: null, products: null });

      const access = await checkAdminAccess(supabase, session.user.id);
      if (!isMounted) return;
      if (!access.allowed) return setLoadState({ status: "access-denied", message: access.reason, categories: null, products: null });

      const [categoriesResult, productsResult] = await Promise.all([getAdminProductCategories(supabase), getAdminProducts(supabase)]);
      if (!isMounted) return;
      const error = categoriesResult.error ?? productsResult.error;
      if (error) return setLoadState({ status: "error", message: error.message, categories: null, products: null });
      setLoadState({ status: "ready", message: null, categories: categoriesResult.data ?? [], products: productsResult.data ?? [] });
    }

    void loadCategories();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void loadCategories(); });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const categories = useMemo(() => (loadState.status === "ready" ? loadState.categories : []), [loadState]);
  const productCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of loadState.status === "ready" ? loadState.products : []) {
      map.set(product.product_category_id, (map.get(product.product_category_id) ?? 0) + 1);
    }
    return map;
  }, [loadState]);

  function replaceCategories(next: AdminProductCategory[]) {
    if (loadState.status === "ready") setLoadState({ ...loadState, categories: next });
  }

  function startEdit(category: AdminProductCategory | null) {
    setFormError("");
    setEditing(category);
    setFormKey((value) => value + 1);
  }

  async function handleSubmit(input: { name: string; description: string | null; status: string }) {
    if (!input.name) return setFormError("กรุณากรอกชื่อหมวดสินค้า");
    if (categories.some((category) => category.id !== editing?.id && category.name.toLowerCase() === input.name.toLowerCase())) {
      return setFormError("มีชื่อหมวดสินค้านี้อยู่แล้ว");
    }

    setSaving(true);
    setFormError("");
    const supabase = createClient();
    const { data, error } = editing
      ? await updateAdminProductCategory(supabase, editing.id, input)
      : await createAdminProductCategory(supabase, input);
    setSaving(false);
    if (error || !data) return setFormError(error?.message ?? "บันทึกไม่สำเร็จ");

    replaceCategories(
      editing
        ? categories.map((category) => (category.id === data.id ? data : category))
        : [...categories, data].sort((a, b) => a.name.localeCompare(b.name, "th")),
    );
    setToast({ message: editing ? `บันทึก "${data.name}" แล้ว` : `เพิ่มหมวด "${data.name}" แล้ว`, tone: "success" });
    startEdit(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteAdminProductCategory(createClient(), deleteTarget.id);
    setDeleting(false);
    const target = deleteTarget;
    setDeleteTarget(null);
    if (error) return setToast({ message: getAdminDeleteErrorMessage(error, "หมวดหมู่สินค้า"), tone: "error" });
    replaceCategories(categories.filter((category) => category.id !== target.id));
    if (editing?.id === target.id) startEdit(null);
    setToast({ message: `ลบหมวด "${target.name}" แล้ว`, tone: "success" });
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {loadState.status !== "ready" ? (
        <AdminLoadMessage loadingLabel="กำลังโหลดหมวดสินค้า..." message={loadState.message} status={loadState.status} />
      ) : (
        <>
          <AdminPageIntro description="จัดการชื่อหมวด รายละเอียด และสถานะการใช้งานของหมวดสินค้า" />

          <div className="grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
            <CategoryForm
              category={editing}
              error={formError}
              key={formKey}
              onCancel={() => startEdit(null)}
              onDelete={setDeleteTarget}
              onSubmit={(input) => void handleSubmit(input)}
              saving={saving}
            />

            {categories.length === 0 ? (
              <AdminEmptyState description="เพิ่มหมวดแรกจากฟอร์มด้านซ้าย" title="ยังไม่มีหมวดสินค้า" />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[var(--color-asphalt)] text-xs font-semibold text-white">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold" scope="col">ชื่อหมวดสินค้า</th>
                      <th className="px-3 py-3.5 text-right font-semibold" scope="col">จำนวนสินค้า</th>
                      <th className="px-3 py-3.5 font-semibold" scope="col">สถานะ</th>
                      <th className="px-5 py-3.5" scope="col"><span className="sr-only">แก้ไข</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => {
                      const count = productCounts.get(category.id) ?? 0;
                      const isEditing = editing?.id === category.id;
                      return (
                        <tr className={`border-t border-[var(--line)] transition ${isEditing ? "bg-red-50/50" : "hover:bg-[var(--color-concrete)]"}`} key={category.id}>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-[var(--foreground)]">{category.name}</p>
                            <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted)]">{category.description || "ไม่มีรายละเอียด"}</p>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-right">
                            <span className="font-bold text-[var(--foreground)]">{count}</span> <span className="text-[var(--muted)]">สินค้า</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                            {category.status === "active" ? <AdminPill tone="done">เปิดใช้งาน</AdminPill> : <AdminPill tone="danger">ปิดใช้งาน</AdminPill>}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[var(--color-asphalt)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-asphalt-2)]" onClick={() => startEdit(category)} type="button">
                              <AdminIcon name="edit" className="h-3.5 w-3.5" /> แก้ไข
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        description={
          deleteTarget
            ? (productCounts.get(deleteTarget.id) ?? 0) > 0
              ? `"${deleteTarget.name}" ยังมีสินค้า ${productCounts.get(deleteTarget.id)} รายการ ถ้าลบอาจไม่สำเร็จหรือกระทบสินค้าเหล่านั้น แนะนำให้ปิดใช้งานแทน`
              : `"${deleteTarget.name}" จะถูกลบถาวรและไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่?`
            : ""
        }
        isLoading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        open={deleteTarget !== null}
        title="ลบหมวดสินค้านี้?"
      />

      <AdminToast message={toast?.message ?? null} onDone={clearToast} tone={toast?.tone} />
    </main>
  );
}
