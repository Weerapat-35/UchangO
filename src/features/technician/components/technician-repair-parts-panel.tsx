"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addTechnicianRepairPart,
  getTechnicianRepairParts,
  removeTechnicianRepairPart,
  type TechnicianRepairPart,
} from "@/features/technician/repair-parts";
import type { Product } from "@/features/products";
import { createClient } from "@/lib/supabase/browser";

function money(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(value);
}

export function TechnicianRepairPartsPanel({
  repairJobId,
  disabled,
}: {
  repairJobId: string;
  disabled: boolean;
}) {
  const [parts, setParts] = useState<TechnicianRepairPart[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(userId: string) {
    const supabase = createClient();
    const result = await getTechnicianRepairParts(supabase, userId, repairJobId);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setParts(result.data?.parts ?? []);
    setProducts(result.data?.products ?? []);
    if (!productId && result.data?.products?.[0]) {
      setProductId(result.data.products[0].id);
    }
    setError(null);
  }

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session?.user) {
        setLoading(false);
        setError("กรุณาเข้าสู่ระบบด้วยบัญชีช่าง");
        return;
      }
      void load(data.session.user.id).finally(() => setLoading(false));
    });
    return () => {
      mounted = false;
    };
  }, [repairJobId]);

  const total = useMemo(
    () => parts.reduce((sum, part) => sum + Number(part.total_price), 0),
    [parts],
  );

  async function handleAdd() {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId || !productId) return;

    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1) {
      setError("จำนวนอะไหล่ต้องเป็นจำนวนเต็มอย่างน้อย 1");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await addTechnicianRepairPart(
      supabase,
      userId,
      repairJobId,
      productId,
      amount,
    );
    if (result.error) {
      setError(result.error.message);
    } else {
      setParts(result.data?.parts ?? []);
      setProducts(result.data?.products ?? []);
      setQuantity("1");
    }
    setSaving(false);
  }

  async function handleRemove(partId: string) {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;

    setSaving(true);
    setError(null);
    const result = await removeTechnicianRepairPart(
      supabase,
      userId,
      repairJobId,
      partId,
    );
    if (result.error) setError(result.error.message);
    else setParts(result.data?.parts ?? []);
    setSaving(false);
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">อะไหล่ที่ใช้ในงาน</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            เลือกอะไหล่ที่ใช้ ระบบจะตัด Stock และบันทึกประวัติการเบิกให้อัตโนมัติ
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--muted)]">ค่าอะไหล่รวม</p>
          <p className="text-xl font-bold text-[var(--brand)]">{money(total)}</p>
        </div>
      </div>

      {!disabled ? (
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_auto] md:items-end">
          <label className="text-sm font-semibold">
            อะไหล่
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--brand)]"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              disabled={saving || loading}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — Stock {product.stock_quantity}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            จำนวน
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3 text-sm outline-none focus:border-[var(--brand)]"
              min={1}
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              disabled={saving || loading}
            />
          </label>
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-5 text-sm font-semibold text-white disabled:opacity-60"
            type="button"
            onClick={() => void handleAdd()}
            disabled={saving || loading || products.length === 0}
          >
            {saving ? "กำลังบันทึก..." : "+ เพิ่มอะไหล่"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        {loading ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">กำลังโหลดรายการอะไหล่...</p>
        ) : parts.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--muted)]">
            ยังไม่มีอะไหล่ที่ใช้ในงานนี้
          </p>
        ) : (
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs text-[var(--muted)]">
                <th className="px-3 py-3">อะไหล่</th>
                <th className="px-3 py-3">จำนวน</th>
                <th className="px-3 py-3">ราคาต่อหน่วย</th>
                <th className="px-3 py-3">รวม</th>
                {!disabled ? <th className="px-3 py-3" /> : null}
              </tr>
            </thead>
            <tbody>
              {parts.map((part) => (
                <tr key={part.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-3 py-3 font-semibold">{part.product?.name ?? "ไม่พบสินค้า"}</td>
                  <td className="px-3 py-3">{part.quantity}</td>
                  <td className="px-3 py-3">{money(Number(part.unit_price))}</td>
                  <td className="px-3 py-3 font-semibold">{money(Number(part.total_price))}</td>
                  {!disabled ? (
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
                        disabled={saving}
                        onClick={() => void handleRemove(part.id)}
                      >
                        คืนอะไหล่
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
