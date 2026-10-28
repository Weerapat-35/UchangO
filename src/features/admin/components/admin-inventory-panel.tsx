"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  checkAdminAccess,
  createAdminInventoryMovement,
  getAdminInventoryMovements,
  getAdminProducts,
  type AdminInventoryMovement,
  type AdminInventoryMovementCreateInput,
  type AdminProduct,
} from "@/features/admin";
import { ProductImageThumb } from "@/features/products/components/product-image-thumb";
import { createClient } from "@/lib/supabase/browser";
import {
  AdminEmptyState,
  AdminLoadMessage,
  AdminPageIntro,
  AdminPill,
  AdminStatCard,
  AdminToast,
  adminDarkButtonClass,
  adminInputClass,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminTextareaClass,
  type AdminPillTone,
} from "./admin-list-ui";

type LoadState =
  | { status: "loading" | "signed-out"; message: null; products: null; movements: null }
  | { status: "access-denied" | "error"; message: string; products: null; movements: null }
  | { status: "ready"; message: null; products: AdminProduct[]; movements: AdminInventoryMovement[] };

type MovementType = AdminInventoryMovement["movement_type"];

/** ประเภทรายการสต็อก ใช้ร่วมกับหน้าตรวจสอบสต็อก */
export const MOVEMENT_TYPES: { value: MovementType; label: string; tone: AdminPillTone; increases: boolean }[] = [
  { value: "stock_in", label: "รับเข้า", tone: "done", increases: true },
  { value: "stock_out", label: "ตัดออก", tone: "amber", increases: false },
  { value: "adjustment_in", label: "ปรับเพิ่ม", tone: "muted", increases: true },
  { value: "adjustment_out", label: "ปรับลด", tone: "muted", increases: false },
  { value: "repair_usage", label: "ใช้งานซ่อม", tone: "dark", increases: false },
  { value: "return", label: "รับคืน", tone: "blue", increases: true },
];

export function getMovementType(value: string) {
  return MOVEMENT_TYPES.find((type) => type.value === value);
}

/** สต็อกเหลือไม่เกินค่านี้ถือว่าใกล้หมด (เท่ากับแดชบอร์ด) */
export const LOW_STOCK_THRESHOLD = 5;

const NOTE_PLACEHOLDER: Record<string, string> = {
  stock_in: "เช่น รับเข้าจากผู้จำหน่าย ใบส่งของ INV-0925",
  stock_out: "เช่น ขายหน้าร้าน หรือสินค้าชำรุด",
  adjustment_in: "เช่น นับสต็อกจริงแล้วเจอเพิ่ม",
  adjustment_out: "เช่น นับสต็อกจริงแล้วขาด",
  repair_usage: "เช่น ใช้ในงานซ่อมรถ กก 1111",
  return: "เช่น ลูกค้าคืนสินค้า คำสั่งซื้อ #1024",
};

async function fetchInventory(): Promise<LoadState> {
  const supabase = createClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return { status: "error", message: sessionError.message, products: null, movements: null };
  if (!session?.user) return { status: "signed-out", message: null, products: null, movements: null };

  const access = await checkAdminAccess(supabase, session.user.id);
  if (!access.allowed) return { status: "access-denied", message: access.reason, products: null, movements: null };

  const [productsResult, movementsResult] = await Promise.all([getAdminProducts(supabase), getAdminInventoryMovements(supabase, 80)]);
  const error = productsResult.error ?? movementsResult.error;
  if (error) return { status: "error", message: error.message, products: null, movements: null };
  return { status: "ready", message: null, products: productsResult.data ?? [], movements: movementsResult.data ?? [] };
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function MovementForm({
  initialProductId,
  onCreate,
  products,
  saving,
  error,
}: {
  initialProductId: string | null;
  onCreate: (input: AdminInventoryMovementCreateInput) => void;
  products: AdminProduct[];
  saving: boolean;
  error: string;
}) {
  const startProduct = products.find((product) => product.id === initialProductId) ?? products[0];
  const [productId, setProductId] = useState(startProduct?.id ?? "");
  const [movementType, setMovementType] = useState<MovementType>("stock_in");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  // ราคาทุนต่อชิ้น (เฉพาะรับเข้า) เริ่มจากราคาทุนของสินค้า
  const [unitCost, setUnitCost] = useState(String(startProduct?.cost_price ?? ""));
  const selectedProduct = products.find((product) => product.id === productId);
  const type = getMovementType(movementType);
  const isStockIn = movementType === "stock_in";
  const purchaseTotal = Math.max(0, quantity) * Math.max(0, Number(unitCost) || 0);
  const stockAfter = selectedProduct ? selectedProduct.stock_quantity + (type?.increases ? quantity : -quantity) : 0;

  function handleProductChange(nextProductId: string) {
    setProductId(nextProductId);
    setUnitCost(String(products.find((product) => product.id === nextProductId)?.cost_price ?? ""));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({
      movement_type: movementType,
      note: note.trim() || null,
      product_id: productId,
      quantity,
      unit_cost: isStockIn && Number(unitCost) > 0 ? Number(unitCost) : null,
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-[var(--foreground)]">บันทึกการเคลื่อนไหวสต็อก</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">ทุกรายการจะเก็บเป็นประวัติ และปรับจำนวนสต็อกของสินค้าให้อัตโนมัติ</p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <label className={adminLabelClass}>
          สินค้า
          <select className={adminInputClass} onChange={(event) => handleProductChange(event.target.value)} value={productId}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name} · คงเหลือ {product.stock_quantity}</option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className={adminLabelClass}>ประเภทการปรับสต็อก</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {MOVEMENT_TYPES.map((option) => {
              const active = option.value === movementType;
              return (
                <button
                  aria-pressed={active}
                  className={`min-h-9 rounded-full px-4 text-sm font-semibold transition ${active ? "bg-[var(--color-safety)] text-white shadow-sm" : "bg-[var(--color-asphalt)] text-white/90 hover:bg-[var(--color-asphalt-2)]"}`}
                  key={option.value}
                  onClick={() => setMovementType(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <p className={adminLabelClass}>จำนวน</p>
          <div className="mt-1.5 flex items-center gap-2">
            <button aria-label="ลดจำนวน" className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)] bg-white text-lg font-bold hover:bg-[var(--color-concrete)]" onClick={() => setQuantity((value) => Math.max(1, value - 1))} type="button">−</button>
            <input
              aria-label="จำนวน"
              className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-center text-base font-semibold outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-red-100"
              inputMode="numeric"
              min={1}
              onChange={(event) => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
              type="number"
              value={quantity}
            />
            <button aria-label="เพิ่มจำนวน" className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)] bg-white text-lg font-bold hover:bg-[var(--color-concrete)]" onClick={() => setQuantity((value) => value + 1)} type="button">+</button>
          </div>
          {selectedProduct ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              สต็อกปัจจุบัน <span className="font-semibold text-[var(--foreground)]">{selectedProduct.stock_quantity}</span>
              {" → "}หลังบันทึก{" "}
              <span className={`font-bold ${stockAfter < 0 ? "text-[var(--color-safety)]" : "text-[var(--foreground)]"}`}>{stockAfter}</span>
            </p>
          ) : null}
        </div>

        {isStockIn ? (
          <div className="rounded-xl bg-[var(--color-concrete)] p-3">
            <label className={adminLabelClass}>
              ราคาทุนต่อชิ้น (บาท)
              <input className={adminInputClass} min={0} onChange={(event) => setUnitCost(event.target.value)} step="0.01" type="number" value={unitCost} />
            </label>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {purchaseTotal > 0
                ? <>บันทึกเป็นเงินออก “ค่าอะไหล่” อัตโนมัติ รวม <span className="font-semibold text-[var(--foreground)]">{purchaseTotal.toLocaleString("th-TH", { style: "currency", currency: "THB" })}</span></>
                : "ใส่ 0 หรือเว้นว่างถ้าไม่ต้องบันทึกเป็นเงินออก"}
            </p>
          </div>
        ) : null}

        <label className={adminLabelClass}>
          หมายเหตุ
          <textarea className={adminTextareaClass} onChange={(event) => setNote(event.target.value)} placeholder={NOTE_PLACEHOLDER[movementType]} value={note} />
        </label>

        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <button className={`${adminPrimaryButtonClass} w-full`} disabled={saving || products.length === 0} type="submit">
          {saving ? "กำลังบันทึก..." : "บันทึกการเคลื่อนไหว"}
        </button>
      </form>
    </section>
  );
}

export function AdminInventoryPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", message: null, products: null, movements: null });
  const [initialProductId, setInitialProductId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const loadInventory = useCallback(async () => {
    setLoadState(await fetchInventory());
  }, []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();
    void fetchInventory().then((state) => {
      if (!isMounted) return;
      setLoadState(state);
      // เปิดจากปุ่ม "รับเข้า/ตัดสต็อก" ในหน้าตรวจสอบสต็อก จะเลือกสินค้านั้นไว้ให้
      setInitialProductId(new URLSearchParams(window.location.search).get("product"));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void fetchInventory().then((state) => { if (isMounted) setLoadState(state); });
    });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const products = useMemo(() => (loadState.status === "ready" ? loadState.products : []), [loadState]);
  const movements = useMemo(() => (loadState.status === "ready" ? loadState.movements : []), [loadState]);
  const totalStock = products.reduce((total, product) => total + product.stock_quantity, 0);
  const lowStockCount = products.filter((product) => product.status === "active" && product.stock_quantity <= LOW_STOCK_THRESHOLD).length;

  async function handleCreateMovement(input: AdminInventoryMovementCreateInput) {
    const product = products.find((current) => current.id === input.product_id);
    if (!product) return setFormError("กรุณาเลือกสินค้า");
    if (!Number.isFinite(input.quantity) || input.quantity < 1) return setFormError("จำนวนต้องอย่างน้อย 1");
    if (!getMovementType(input.movement_type)?.increases && input.quantity > product.stock_quantity) {
      return setFormError(`จำนวนมากกว่าสต็อกที่มีอยู่ (${product.stock_quantity})`);
    }

    setSaving(true);
    setFormError("");
    const { error } = await createAdminInventoryMovement(createClient(), input);
    setSaving(false);
    if (error) return setFormError(error.message);

    await loadInventory();
    setInitialProductId(input.product_id);
    setFormKey((value) => value + 1);
    setToast({
      message: input.unit_cost
        ? `บันทึก${getMovementType(input.movement_type)?.label ?? ""} ${product.name} แล้ว และลงเงินออกค่าอะไหล่ให้แล้ว`
        : `บันทึก${getMovementType(input.movement_type)?.label ?? ""} ${product.name} ${input.quantity} ชิ้นแล้ว`,
      tone: "success",
    });
  }

  const visibleMovements = showAll ? movements : movements.slice(0, 12);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {loadState.status !== "ready" ? (
        <AdminLoadMessage loadingLabel="กำลังโหลดคลังสินค้า..." message={loadState.message} status={loadState.status} />
      ) : (
        <>
          <AdminPageIntro
            action={
              <>
                <Link className={adminPrimaryButtonClass} href="/admin/inventory-review">ตรวจสต็อก</Link>
                <Link className={adminDarkButtonClass} href="/admin/products">จัดการสินค้า</Link>
              </>
            }
            description="บันทึกรับเข้า ตัดออก ปรับสต็อก ใช้อะไหล่งานซ่อม และรับคืน พร้อมประวัติครบถ้วน"
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <AdminStatCard highlight label="สินค้าทั้งหมด" value={products.length} />
            <AdminStatCard label="สต็อกรวม (ชิ้น)" value={totalStock.toLocaleString("th-TH")} />
            <AdminStatCard label="สินค้าใกล้หมด" value={lowStockCount} />
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
            <MovementForm
              error={formError}
              initialProductId={initialProductId}
              key={`${formKey}-${initialProductId ?? ""}`}
              onCreate={(input) => void handleCreateMovement(input)}
              products={products}
              saving={saving}
            />

            <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
              <div className="px-5 py-4">
                <h2 className="text-lg font-bold text-[var(--color-safety)]">ประวัติการเคลื่อนไหวล่าสุด</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">รายการปรับเปลี่ยนสต็อกล่าสุดของสินค้าทั้งหมด</p>
              </div>
              {movements.length === 0 ? (
                <div className="px-5 pb-5"><AdminEmptyState title="ยังไม่มีรายการเคลื่อนไหว" description="บันทึกรายการแรกจากฟอร์มด้านซ้าย" /></div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                      <thead className="bg-[var(--color-asphalt)] text-xs font-semibold text-white">
                        <tr>
                          <th className="px-5 py-3 font-semibold" scope="col">วันที่</th>
                          <th className="px-3 py-3 font-semibold" scope="col">สินค้า</th>
                          <th className="px-3 py-3 font-semibold" scope="col">ประเภท</th>
                          <th className="px-3 py-3 text-right font-semibold" scope="col">จำนวน</th>
                          <th className="px-5 py-3 font-semibold" scope="col">ผู้บันทึก</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleMovements.map((movement) => {
                          const type = getMovementType(movement.movement_type);
                          const delta = type?.increases ? movement.quantity : -movement.quantity;
                          return (
                            <tr className="border-t border-[var(--line)] align-top hover:bg-[var(--color-concrete)]" key={movement.id}>
                              <td className="whitespace-nowrap px-5 py-3 text-[var(--muted)]">{formatDateTime(movement.created_at)}</td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-3">
                                  <ProductImageThumb alt={`รูปสินค้า ${movement.product?.name ?? "สินค้า"}`} size="sm" src={movement.product?.image_url} />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-[var(--foreground)]">{movement.product?.name ?? "ไม่พบสินค้า"}</p>
                                    {movement.note ? <p className="line-clamp-1 text-xs text-[var(--muted)]">{movement.note}</p> : null}
                                  </div>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-3"><AdminPill tone={type?.tone ?? "muted"}>{type?.label ?? movement.movement_type}</AdminPill></td>
                              <td className={`whitespace-nowrap px-3 py-3 text-right text-base font-bold ${delta >= 0 ? "text-[var(--color-signal)]" : "text-[var(--color-safety)]"}`}>
                                {delta >= 0 ? "+" : "−"}{Math.abs(delta)}
                              </td>
                              <td className="whitespace-nowrap px-5 py-3 text-[var(--muted)]">{movement.createdBy?.full_name ?? "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {movements.length > 12 ? (
                    <button className="w-full border-t border-[var(--line)] py-3 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--color-concrete)] hover:text-[var(--foreground)]" onClick={() => setShowAll((value) => !value)} type="button">
                      {showAll ? "แสดงน้อยลง" : `ดูทั้งหมด ${movements.length} รายการ`}
                    </button>
                  ) : null}
                </>
              )}
            </section>
          </div>
        </>
      )}

      <AdminToast message={toast?.message ?? null} onDone={clearToast} tone={toast?.tone} />
    </main>
  );
}
