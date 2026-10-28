"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  checkAdminAccess,
  getAdminInventoryMovements,
  getAdminProducts,
  type AdminInventoryMovement,
  type AdminProduct,
} from "@/features/admin";
import { ProductImageThumb } from "@/features/products/components/product-image-thumb";
import { createClient } from "@/lib/supabase/browser";
import { LOW_STOCK_THRESHOLD, getMovementType } from "./admin-inventory-panel";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminLoadMessage,
  AdminPageIntro,
  AdminPill,
  AdminStatCard,
  adminDarkButtonClass,
  adminPrimaryButtonClass,
  type AdminPillTone,
} from "./admin-list-ui";

type LoadState =
  | { status: "loading" | "signed-out"; message: null; products: null; movements: null }
  | { status: "access-denied" | "error"; message: string; products: null; movements: null }
  | { status: "ready"; message: null; products: AdminProduct[]; movements: AdminInventoryMovement[] };

type StockStatus = "out" | "low" | "healthy" | "inactive";
type StockFilter = "all" | StockStatus;

const STOCK_STATUS: Record<StockStatus, { label: string; tone: AdminPillTone; order: number }> = {
  out: { label: "หมดสต็อก", tone: "danger", order: 0 },
  low: { label: "ใกล้หมด", tone: "amber", order: 1 },
  healthy: { label: "พร้อมขาย", tone: "done", order: 2 },
  inactive: { label: "ปิดใช้งาน", tone: "muted", order: 3 },
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function getStockStatus(product: AdminProduct): StockStatus {
  if (product.status === "inactive") return "inactive";
  if (product.stock_quantity <= 0) return "out";
  if (product.stock_quantity <= LOW_STOCK_THRESHOLD) return "low";
  return "healthy";
}

export function AdminInventoryReviewPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", message: null, products: null, movements: null });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadInventoryReview() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) return setLoadState({ status: "error", message: sessionError.message, products: null, movements: null });
      if (!session?.user) return setLoadState({ status: "signed-out", message: null, products: null, movements: null });

      const access = await checkAdminAccess(supabase, session.user.id);
      if (!isMounted) return;
      if (!access.allowed) return setLoadState({ status: "access-denied", message: access.reason, products: null, movements: null });

      const [productsResult, movementsResult] = await Promise.all([getAdminProducts(supabase), getAdminInventoryMovements(supabase, 200)]);
      if (!isMounted) return;
      const error = productsResult.error ?? movementsResult.error;
      if (error) return setLoadState({ status: "error", message: error.message, products: null, movements: null });
      setLoadState({ status: "ready", message: null, products: productsResult.data ?? [], movements: movementsResult.data ?? [] });
    }

    void loadInventoryReview();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void loadInventoryReview(); });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const products = useMemo(() => (loadState.status === "ready" ? loadState.products : []), [loadState]);

  const latestMovementByProduct = useMemo(() => {
    const map = new Map<string, AdminInventoryMovement>();
    // รายการเรียงล่าสุดก่อน เก็บเฉพาะรายการแรกของแต่ละสินค้า
    for (const movement of loadState.status === "ready" ? loadState.movements : []) {
      if (!map.has(movement.product_id)) map.set(movement.product_id, movement);
    }
    return map;
  }, [loadState]);

  const counts = useMemo(() => {
    const result: Record<StockStatus, number> = { out: 0, low: 0, healthy: 0, inactive: 0 };
    for (const product of products) result[getStockStatus(product)] += 1;
    return result;
  }, [products]);
  const totalStock = products.filter((product) => product.status === "active").reduce((total, product) => total + product.stock_quantity, 0);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return products
      .filter((product) =>
        (filter === "all" || getStockStatus(product) === filter) &&
        (!keyword ||
          product.name.toLowerCase().includes(keyword) ||
          (product.sku ?? "").toLowerCase().includes(keyword) ||
          (product.category?.name ?? "").toLowerCase().includes(keyword)),
      )
      // ของที่ต้องจัดการก่อน (หมด → ใกล้หมด) อยู่บนสุด แล้วเรียงสต็อกน้อยไปมาก
      .sort((a, b) => STOCK_STATUS[getStockStatus(a)].order - STOCK_STATUS[getStockStatus(b)].order || a.stock_quantity - b.stock_quantity);
  }, [products, search, filter]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {loadState.status !== "ready" ? (
        <AdminLoadMessage loadingLabel="กำลังโหลดสต็อก..." message={loadState.message} status={loadState.status} />
      ) : (
        <>
          <AdminPageIntro
            action={
              <>
                <Link className={adminPrimaryButtonClass} href="/admin/inventory">บันทึกสต็อก</Link>
                <Link className={adminDarkButtonClass} href="/admin/products">จัดการสินค้า</Link>
              </>
            }
            description="ตรวจสอบสินค้าหมดสต็อก ใกล้หมด และสินค้าพร้อมขาย ก่อนรับสินค้าเข้าหรือตัดสต็อก"
          />

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <AdminStatCard highlight label="สินค้าทั้งหมด" value={products.length} />
            <AdminStatCard label="หมดสต็อก" value={counts.out} />
            <AdminStatCard label="ใกล้หมด" value={counts.low} />
            <AdminStatCard label="จำนวนสต็อกรวม (ชิ้น)" value={totalStock.toLocaleString("th-TH")} />
          </div>

          <AdminFilterBar
            filter={filter}
            filters={[
              { value: "all" as StockFilter, label: "ทั้งหมด", count: products.length },
              ...(Object.keys(STOCK_STATUS) as StockStatus[]).map((status) => ({ value: status as StockFilter, label: STOCK_STATUS[status].label, count: counts[status] })),
            ]}
            onFilterChange={setFilter}
            onSearchChange={setSearch}
            search={search}
            searchPlaceholder="ค้นหาชื่อสินค้า SKU หรือหมวดสินค้า"
          />

          {filtered.length === 0 ? (
            <AdminEmptyState description={products.length === 0 ? "เพิ่มสินค้าที่หน้าจัดการสินค้าก่อน" : "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"} title={products.length === 0 ? "ยังไม่มีสินค้า" : "ไม่พบสินค้าที่ค้นหา"} />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                  <thead className="bg-[var(--color-asphalt)] text-xs font-semibold text-white">
                    <tr>
                      <th className="px-5 py-3 font-semibold" scope="col">สินค้า</th>
                      <th className="px-3 py-3 font-semibold" scope="col">หมวดสินค้า</th>
                      <th className="px-3 py-3 font-semibold" scope="col">สถานะสต็อก</th>
                      <th className="px-3 py-3 text-right font-semibold" scope="col">สต็อก</th>
                      <th className="px-3 py-3 text-right font-semibold" scope="col">ราคาขาย</th>
                      <th className="px-3 py-3 font-semibold" scope="col">เคลื่อนไหวล่าสุด</th>
                      <th className="px-5 py-3 text-right font-semibold" scope="col">คำสั่ง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((product) => {
                      const status = STOCK_STATUS[getStockStatus(product)];
                      const latest = latestMovementByProduct.get(product.id);
                      return (
                        <tr className={`border-t border-[var(--line)] hover:bg-[var(--color-concrete)] ${product.status === "inactive" ? "text-[var(--muted)]" : ""}`} key={product.id}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <ProductImageThumb alt={`รูปสินค้า ${product.name}`} size="sm" src={product.image_url} />
                              <div className="min-w-0">
                                <p className="font-semibold text-[var(--foreground)]">{product.name}</p>
                                {product.sku ? <p className="text-xs text-[var(--muted)]">SKU {product.sku}</p> : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-[var(--muted)]">{product.category?.name ?? "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3"><AdminPill tone={status.tone}>{status.label}</AdminPill></td>
                          <td className={`px-3 py-3 text-right text-base font-bold ${product.stock_quantity <= 0 ? "text-[var(--color-safety)]" : "text-[var(--foreground)]"}`}>{product.stock_quantity}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right">{currencyFormatter.format(product.unit_price)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-[var(--muted)]">
                            {latest
                              ? `${getMovementType(latest.movement_type)?.label ?? latest.movement_type} · ${new Date(latest.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`
                              : "-"}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link className="inline-flex min-h-9 items-center whitespace-nowrap rounded-xl bg-[var(--color-asphalt)] px-3.5 text-xs font-semibold text-white hover:bg-[var(--color-asphalt-2)]" href={`/admin/inventory?product=${product.id}`}>
                              รับเข้า/ตัดสต็อก
                            </Link>
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
    </main>
  );
}
