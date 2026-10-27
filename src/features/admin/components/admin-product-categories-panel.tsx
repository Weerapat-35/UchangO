"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  checkAdminAccess,
  createAdminProductCategory,
  deleteAdminProductCategory,
  getAdminDeleteErrorMessage,
  getAdminProductCategories,
  updateAdminProductCategory,
  type AdminAccessResult,
  type AdminProductCategory,
  type AdminProductCategoryCreateInput,
  type AdminProductCategoryUpdateInput,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";
import { recordStatusLabel } from "@/lib/status-labels";

type LoadState =
  | { status: "loading"; access: null; categories: null; error: null }
  | { status: "signed-out"; access: null; categories: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      categories: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      categories: AdminProductCategory[];
      error: null;
    }
  | { status: "error"; access: null; categories: null; error: string };

type ActionState =
  | { status: "idle"; categoryId: null; error: null; message: null }
  | { status: "saving"; categoryId: string; error: null; message: null }
  | { status: "deleting"; categoryId: string; error: null; message: null }
  | { status: "error"; categoryId: string; error: string; message: null }
  | { status: "saved"; categoryId: string; error: null; message: string };

type CreateState =
  | { status: "idle"; error: null; message: null }
  | { status: "creating"; error: null; message: null }
  | { status: "error"; error: string; message: null }
  | { status: "created"; error: null; message: string };

type StatusFilter = "all" | AdminProductCategory["status"];

const statusFilters: StatusFilter[] = ["all", "active", "inactive"];

function getStatusStyle(status: AdminProductCategory["status"]) {
  if (status === "active") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  return "bg-slate-100 text-slate-700";
}

function validateCategoryInput(input: AdminProductCategoryUpdateInput) {
  if (!input.name.trim()) {
    return "กรุณากรอกชื่อหมวดหมู่";
  }

  return null;
}

function AddProductCategoryForm({
  createState,
  onCreate,
}: {
  createState: CreateState;
  onCreate: (input: AdminProductCategoryCreateInput) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] =
    useState<AdminProductCategory["status"]>("active");
  const isCreating = createState.status === "creating";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({
      description: description.trim() || null,
      name: name.trim(),
      status,
    });
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="border-b border-[var(--line)] pb-4">
        <p className="text-sm font-semibold text-[var(--brand)]">
          เพิ่มหมวดสินค้า
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          หมวดหมู่ใหม่จะแสดงในตัวเลือกหมวดสินค้าทันที
        </p>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px] md:items-end">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            ชื่อหมวดหมู่
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setName(event.target.value)}
              placeholder="เช่น อะไหล่เครื่องยนต์"
              value={name}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            สถานะ
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) =>
                setStatus(event.target.value as AdminProductCategory["status"])
              }
              value={status}
            >
              <option value="active">เปิดใช้งาน</option>
              <option value="inactive">ปิดใช้งาน</option>
            </select>
          </label>
        </div>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          รายละเอียด
          <textarea
            className="mt-2 min-h-20 w-full resize-y rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating}
            type="submit"
          >
            {isCreating ? "กำลังเพิ่ม..." : "เพิ่มหมวดสินค้า"}
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

function AdminProductCategoryRow({
  actionState,
  category,
  onDelete,
  onSave,
}: {
  actionState: ActionState;
  category: AdminProductCategory;
  onDelete: (category: AdminProductCategory) => void;
  onSave: (
    category: AdminProductCategory,
    input: AdminProductCategoryUpdateInput,
  ) => void;
}) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? "");
  const [status, setStatus] =
    useState<AdminProductCategory["status"]>(category.status);
  const isSaving =
    actionState.status === "saving" && actionState.categoryId === category.id;
  const isDeleting =
    actionState.status === "deleting" && actionState.categoryId === category.id;
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const hasChanges =
    name.trim() !== category.name ||
    description.trim() !== (category.description ?? "") ||
    status !== category.status;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(category, {
      description: description.trim() || null,
      name: name.trim(),
      status,
    });
  }

  function handleDeleteClick() {
    setIsConfirmOpen(true);
  }

  function handleConfirmDelete() {
    setIsConfirmOpen(false);
    onDelete(category);
  }

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="mb-3 flex justify-end">
        <button
          aria-label="ลบหมวดหมู่สินค้า"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving || isDeleting}
          onClick={handleDeleteClick}
          title="ลบหมวดหมู่สินค้า"
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
      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
              category.status,
            )}`}
          >
            {recordStatusLabel(category.status)}
          </span>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {category.name}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {category.description ?? "-"}
          </p>
        </div>
        <p className="text-xs text-[var(--muted)]">
          แก้ไขล่าสุด {new Date(category.updated_at).toLocaleString("th-TH")}
        </p>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px] md:items-end">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            ชื่อหมวดหมู่
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            สถานะ
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) =>
                setStatus(event.target.value as AdminProductCategory["status"])
              }
              value={status}
            >
              <option value="active">เปิดใช้งาน</option>
              <option value="inactive">ปิดใช้งาน</option>
            </select>
          </label>
        </div>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          รายละเอียด
          <textarea
            className="mt-2 min-h-24 w-full resize-y rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!hasChanges || isSaving || isDeleting}
            type="submit"
          >
            {isSaving ? "กำลังบันทึก..." : "บันทึกหมวดสินค้า"}
          </button>

          {actionState.status === "error" &&
          actionState.categoryId === category.id ? (
            <p className="text-sm text-red-700">{actionState.error}</p>
          ) : null}

          {actionState.status === "saved" &&
          actionState.categoryId === category.id ? (
            <p className="text-sm font-semibold text-[var(--brand-strong)]">
              {actionState.message}
            </p>
          ) : null}
        </div>
      </form>

      <ConfirmDialog
        description={`"${category.name}" จะถูกลบถาวร รวมถึงสินค้าทั้งหมดในหมวดนี้และข้อมูลที่เกี่ยวข้อง และไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่?`}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        open={isConfirmOpen}
        title="ลบหมวดหมู่สินค้านี้?"
      />
    </article>
  );
}

export function AdminProductCategoriesPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    categories: null,
    error: null,
    status: "loading",
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [actionState, setActionState] = useState<ActionState>({
    categoryId: null,
    error: null,
    message: null,
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

    async function loadCategories() {
      setLoadState({
        access: null,
        categories: null,
        error: null,
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
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          categories: null,
          error: null,
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
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminProductCategories(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          categories: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        categories: data ?? [],
        error: null,
        status: "ready",
      });
    }

    void loadCategories();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadCategories();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const filteredCategories = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    const normalizedSearch = searchInput.trim().toLowerCase();

    return loadState.categories.filter((category) => {
      const matchesStatus =
        statusFilter === "all" || category.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        category.name.toLowerCase().includes(normalizedSearch) ||
        (category.description ?? "").toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [loadState, searchInput, statusFilter]);

  async function handleCreateCategory(input: AdminProductCategoryCreateInput) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateCategoryInput(input);

    if (validationError) {
      setCreateState({
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    const duplicateCategory = loadState.categories.find(
      (category) => category.name.toLowerCase() === input.name.toLowerCase(),
    );

    if (duplicateCategory) {
      setCreateState({
        error: "มีชื่อหมวดสินค้านี้อยู่แล้ว",
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
    const { data, error } = await createAdminProductCategory(supabase, input);

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
      categories: [...loadState.categories, data].sort((a, b) =>
        a.name.localeCompare(b.name, "th"),
      ),
    });
    setCreateState({
      error: null,
      message: "เพิ่มหมวดสินค้าเรียบร้อยแล้ว",
      status: "created",
    });
  }

  async function handleSaveCategory(
    category: AdminProductCategory,
    input: AdminProductCategoryUpdateInput,
  ) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateCategoryInput(input);

    if (validationError) {
      setActionState({
        categoryId: category.id,
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    const duplicateCategory = loadState.categories.find(
      (currentCategory) =>
        currentCategory.id !== category.id &&
        currentCategory.name.toLowerCase() === input.name.toLowerCase(),
    );

    if (duplicateCategory) {
      setActionState({
        categoryId: category.id,
        error: "มีชื่อหมวดสินค้านี้อยู่แล้ว",
        message: null,
        status: "error",
      });
      return;
    }

    setActionState({
      categoryId: category.id,
      error: null,
      message: null,
      status: "saving",
    });

    const supabase = createClient();
    const { data, error } = await updateAdminProductCategory(
      supabase,
      category.id,
      input,
    );

    if (error) {
      setActionState({
        categoryId: category.id,
        error: error.message,
        message: null,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      categories: loadState.categories.map((currentCategory) =>
        currentCategory.id === category.id ? data : currentCategory,
      ),
    });
    setActionState({
      categoryId: category.id,
      error: null,
      message: "บันทึกหมวดสินค้าเรียบร้อยแล้ว",
      status: "saved",
    });
  }

  async function handleDeleteCategory(category: AdminProductCategory) {
    if (loadState.status !== "ready") {
      return;
    }

    setActionState({
      error: null,
      message: null,
      categoryId: category.id,
      status: "deleting",
    });

    const supabase = createClient();
    const { error } = await deleteAdminProductCategory(supabase, category.id);

    if (error) {
      setActionState({
        error: getAdminDeleteErrorMessage(error, "หมวดหมู่สินค้า"),
        message: null,
        categoryId: category.id,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      categories: loadState.categories.filter(
        (current) => current.id !== category.id,
      ),
    });
    setActionState({
      error: null,
      message: null,
      categoryId: null,
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
              หมวดสินค้า
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/admin/products"
            >
              จัดการสินค้า
            </Link>
            <Link
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
              href="/admin"
            >
              กลับแดชบอร์ด
            </Link>
          </div>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดหมวดสินค้า...
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
          <AddProductCategoryForm
            createState={createState}
            key={loadState.categories.length}
            onCreate={handleCreateCategory}
          />

          <div className="mt-5 flex flex-col gap-4 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {filteredCategories.length} จาก {loadState.categories.length}{" "}
                หมวดสินค้า
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                หมวดที่ปิดใช้งานยังดูได้ในหน้าแอดมิน แต่จะไม่แสดงในหน้าขายสินค้า
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl">
              <input
                className="min-h-10 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="ค้นหาหมวดสินค้า"
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

          {filteredCategories.length > 0 ? (
            <div className="mt-5 space-y-4">
              {filteredCategories.map((category) => (
                <AdminProductCategoryRow
                  actionState={actionState}
                  category={category}
                  key={category.id}
                  onDelete={handleDeleteCategory}
                  onSave={handleSaveCategory}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบหมวดสินค้าที่ตรงกับตัวกรอง
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
