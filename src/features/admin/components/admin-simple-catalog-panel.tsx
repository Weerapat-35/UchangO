"use client";

// หน้ารายการแบบ ชื่อ + รายละเอียด + เปิด/ปิดใช้งาน ใช้ร่วมกันระหว่างหมวดบริการและทักษะช่าง
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { checkAdminAccess, type AdminAccessResult } from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";
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

type BCareClient = ReturnType<typeof createClient>;

export type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  /** "active" | "inactive" */
  status: string;
  updated_at: string;
};

export type CatalogInput = Pick<CatalogItem, "name" | "description" | "status">;

type CatalogError = { message: string };

type Result<T> = { data: T | null; error: CatalogError | null };

export type CatalogConfig<T extends CatalogItem, E extends CatalogError = CatalogError> = {
  /** เช่น "หมวดหมู่", "ทักษะ" */
  noun: string;
  intro: string;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  load: (supabase: BCareClient) => Promise<Result<T[]>>;
  create: (supabase: BCareClient, input: CatalogInput) => Promise<Result<T>>;
  update: (supabase: BCareClient, id: string, input: CatalogInput) => Promise<Result<T>>;
  /** ไม่ส่งมา = ลบไม่ได้ (ปิดใช้งานแทน) */
  remove?: (supabase: BCareClient, id: string) => Promise<{ error: E | null }>;
  removeWarning?: (item: T) => string;
  removeErrorMessage?: (error: E) => string;
};

type LoadState<T> =
  | { status: "loading" | "signed-out"; items: null; message: null }
  | { status: "access-denied"; items: null; message: string }
  | { status: "error"; items: null; message: string }
  | { status: "ready"; items: T[]; message: null; access: AdminAccessResult };

type StatusFilter = "all" | "active" | "inactive";

type EditorState<T> = { mode: "create" } | { mode: "edit"; item: T } | null;

function formatUpdated(value: string) {
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function CatalogEditor<T extends CatalogItem, E extends CatalogError>({
  config,
  editor,
  error,
  onClose,
  onSubmit,
  saving,
}: {
  config: CatalogConfig<T, E>;
  editor: Exclude<EditorState<T>, null>;
  error: string;
  onClose: () => void;
  onSubmit: (input: CatalogInput) => void;
  saving: boolean;
}) {
  const initial = editor.mode === "edit" ? editor.item : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState((initial?.status ?? "active") === "active");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ name: name.trim(), description: description.trim() || null, status: active ? "active" : "inactive" });
  }

  return (
    <AdminModal
      footer={
        <>
          <button className={adminSecondaryButtonClass} onClick={onClose} type="button">ยกเลิก</button>
          <button className={adminPrimaryButtonClass} disabled={saving || !name.trim()} form="catalog-editor" type="submit">
            {saving ? "กำลังบันทึก..." : editor.mode === "create" ? `เพิ่ม${config.noun}` : "บันทึกการแก้ไข"}
          </button>
        </>
      }
      onClose={onClose}
      open
      title={editor.mode === "create" ? `เพิ่ม${config.noun}ใหม่` : `แก้ไข${config.noun}`}
    >
      <form className="space-y-4" id="catalog-editor" onSubmit={handleSubmit}>
        <label className={adminLabelClass}>
          ชื่อ{config.noun}
          <input autoFocus className={adminInputClass} onChange={(event) => setName(event.target.value)} placeholder={config.namePlaceholder} value={name} />
        </label>
        <label className={adminLabelClass}>
          รายละเอียด <span className="font-normal text-[var(--muted)]">(ไม่บังคับ)</span>
          <textarea className={adminTextareaClass} onChange={(event) => setDescription(event.target.value)} placeholder={config.descriptionPlaceholder} value={description} />
        </label>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">เปิดใช้งาน</p>
            <p className="text-xs text-[var(--muted)]">ปิดไว้ถ้ายังไม่ต้องการให้เลือกใช้</p>
          </div>
          <AdminActiveSwitch active={active} label="เปิดใช้งาน" onToggle={() => setActive((value) => !value)} />
        </div>
        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      </form>
    </AdminModal>
  );
}

export function AdminSimpleCatalogPanel<T extends CatalogItem, E extends CatalogError>({ config }: { config: CatalogConfig<T, E> }) {
  const [loadState, setLoadState] = useState<LoadState<T>>({ status: "loading", items: null, message: null });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editor, setEditor] = useState<EditorState<T>>(null);
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function load() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) return setLoadState({ status: "error", items: null, message: sessionError.message });
      if (!session?.user) return setLoadState({ status: "signed-out", items: null, message: null });

      const access = await checkAdminAccess(supabase, session.user.id);
      if (!isMounted) return;
      if (!access.allowed) return setLoadState({ status: "access-denied", items: null, message: access.reason });

      const { data, error } = await config.load(supabase);
      if (!isMounted) return;
      if (error) return setLoadState({ status: "error", items: null, message: error.message });
      setLoadState({ status: "ready", items: data ?? [], message: null, access });
    }

    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void load(); });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [config]);

  const items = useMemo(() => (loadState.status === "ready" ? loadState.items : []), [loadState]);
  const activeCount = items.filter((item) => item.status === "active").length;
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) =>
      (filter === "all" || item.status === filter) &&
      (!keyword || item.name.toLowerCase().includes(keyword) || (item.description ?? "").toLowerCase().includes(keyword)),
    );
  }, [items, search, filter]);

  function replaceItems(next: T[]) {
    if (loadState.status === "ready") setLoadState({ ...loadState, items: next });
  }

  function openEditor(next: EditorState<T>) {
    setEditorError("");
    setEditor(next);
  }

  async function handleSubmit(input: CatalogInput) {
    if (!editor || loadState.status !== "ready") return;
    if (!input.name) return setEditorError(`กรุณากรอกชื่อ${config.noun}`);
    const duplicate = items.find((item) => item.name.toLowerCase() === input.name.toLowerCase() && (editor.mode === "create" || item.id !== editor.item.id));
    if (duplicate) return setEditorError(`มีชื่อ${config.noun}นี้อยู่แล้ว`);

    setSaving(true);
    setEditorError("");
    const supabase = createClient();
    const { data, error } = editor.mode === "create"
      ? await config.create(supabase, input)
      : await config.update(supabase, editor.item.id, input);
    setSaving(false);

    if (error || !data) return setEditorError(error?.message ?? "บันทึกไม่สำเร็จ");

    replaceItems(
      editor.mode === "create"
        ? [...items, data].sort((a, b) => a.name.localeCompare(b.name, "th"))
        : items.map((item) => (item.id === data.id ? data : item)),
    );
    setEditor(null);
    setToast({ message: editor.mode === "create" ? `เพิ่ม${config.noun} "${data.name}" แล้ว` : `บันทึก "${data.name}" แล้ว`, tone: "success" });
  }

  async function handleToggle(item: T) {
    setTogglingId(item.id);
    const { data, error } = await config.update(createClient(), item.id, {
      name: item.name,
      description: item.description,
      status: item.status === "active" ? "inactive" : "active",
    });
    setTogglingId(null);
    if (error || !data) return setToast({ message: error?.message ?? "เปลี่ยนสถานะไม่สำเร็จ", tone: "error" });
    replaceItems(items.map((current) => (current.id === data.id ? data : current)));
    setToast({ message: `${data.status === "active" ? "เปิด" : "ปิด"}ใช้งาน "${data.name}" แล้ว`, tone: "success" });
  }

  async function handleDelete() {
    if (!deleteTarget || !config.remove) return;
    setDeleting(true);
    const { error } = await config.remove(createClient(), deleteTarget.id);
    setDeleting(false);
    const target = deleteTarget;
    setDeleteTarget(null);
    if (error) return setToast({ message: config.removeErrorMessage?.(error) ?? error.message, tone: "error" });
    replaceItems(items.filter((item) => item.id !== target.id));
    setToast({ message: `ลบ "${target.name}" แล้ว`, tone: "success" });
  }

  const addButton = (
    <button className={adminPrimaryButtonClass} onClick={() => openEditor({ mode: "create" })} type="button">
      <AdminIcon name="plus" /> เพิ่ม{config.noun}
    </button>
  );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {loadState.status !== "ready" ? (
        <AdminLoadMessage loadingLabel={`กำลังโหลด${config.noun}...`} message={loadState.message} status={loadState.status} />
      ) : (
        <>
          <AdminPageIntro action={addButton} description={config.intro} />

          <AdminFilterBar
            filter={filter}
            filters={[
              { value: "all", label: "ทั้งหมด", count: items.length },
              { value: "active", label: "เปิดใช้งาน", count: activeCount },
              { value: "inactive", label: "ปิดใช้งาน", count: items.length - activeCount },
            ]}
            onFilterChange={setFilter}
            onSearchChange={setSearch}
            search={search}
            searchPlaceholder={`ค้นหา${config.noun}`}
          />

          {filtered.length === 0 ? (
            <AdminEmptyState
              action={items.length === 0 ? addButton : undefined}
              description={items.length === 0 ? `เริ่มต้นด้วยการเพิ่ม${config.noun}แรก` : "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"}
              title={items.length === 0 ? `ยังไม่มี${config.noun}` : `ไม่พบ${config.noun}ที่ค้นหา`}
            />
          ) : (
            <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
              {filtered.map((item) => (
                <li className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center" key={item.id}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[var(--foreground)]">{item.name}</p>
                      {item.status === "active" ? <AdminPill tone="green">เปิดใช้งาน</AdminPill> : <AdminPill tone="gray">ปิดใช้งาน</AdminPill>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{item.description || "ไม่มีรายละเอียด"}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-xs text-[var(--muted)]">แก้ไข {formatUpdated(item.updated_at)}</span>
                    <div className="flex items-center gap-1">
                      <AdminActiveSwitch active={item.status === "active"} disabled={togglingId === item.id} label={`เปิด/ปิดใช้งาน ${item.name}`} onToggle={() => void handleToggle(item)} />
                      <span className="mx-1 h-6 w-px bg-[var(--line)]" aria-hidden="true" />
                      <AdminIconButton icon="edit" label={`แก้ไข ${item.name}`} onClick={() => openEditor({ mode: "edit", item })} />
                      {config.remove ? <AdminIconButton icon="trash" label={`ลบ ${item.name}`} onClick={() => setDeleteTarget(item)} tone="danger" /> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {editor ? (
        <CatalogEditor
          config={config}
          editor={editor}
          error={editorError}
          key={editor.mode === "edit" ? editor.item.id : "create"}
          onClose={() => setEditor(null)}
          onSubmit={(input) => void handleSubmit(input)}
          saving={saving}
        />
      ) : null}

      <ConfirmDialog
        description={deleteTarget ? config.removeWarning?.(deleteTarget) ?? `"${deleteTarget.name}" จะถูกลบถาวรและไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่?` : ""}
        isLoading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        open={deleteTarget !== null}
        title={`ลบ${config.noun}นี้?`}
      />

      <AdminToast message={toast?.message ?? null} onDone={clearToast} tone={toast?.tone} />
    </main>
  );
}
