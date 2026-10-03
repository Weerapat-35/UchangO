"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  checkAdminAccess,
  createAdminFinanceTransaction,
  deleteAdminFinanceTransaction,
  getAdminFinanceTransactions,
  type AdminAccessResult,
  type AdminFinanceTransaction,
  type AdminFinanceTransactionInput,
  type AdminFinanceTransactionType,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

const currency = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 2,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function monthEnd(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
}

type LoadState =
  | { status: "loading"; access: null; error: null; data: null }
  | { status: "signed-out"; access: null; error: null; data: null }
  | { status: "denied"; access: Extract<AdminAccessResult, { allowed: false }>; error: null; data: null }
  | { status: "ready"; access: AdminAccessResult; error: null; data: Awaited<ReturnType<typeof getAdminFinanceTransactions>>["data"] }
  | { status: "error"; access: null; error: string; data: null };

const emptyForm: AdminFinanceTransactionInput = {
  amount: 0,
  category: "ค่าใช้จ่ายทั่วไป",
  description: null,
  transactionDate: today(),
  transactionType: "expense",
};

export function AdminFinancePanel() {
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(monthEnd());
  const [loadState, setLoadState] = useState<LoadState>({
    status: "loading",
    access: null,
    error: null,
    data: null,
  });
  const [form, setForm] = useState<AdminFinanceTransactionInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  async function load() {
    const supabase = createClient();
    setLoadState({ status: "loading", access: null, error: null, data: null });

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      setLoadState({ status: "error", access: null, error: sessionError.message, data: null });
      return;
    }
    if (!sessionData.session?.user) {
      setLoadState({ status: "signed-out", access: null, error: null, data: null });
      return;
    }

    const access = await checkAdminAccess(supabase, sessionData.session.user.id);
    if (!access.allowed) {
      setLoadState({ status: "denied", access, error: null, data: null });
      return;
    }

    const result = await getAdminFinanceTransactions(supabase, startDate, endDate);
    if (result.error) {
      setLoadState({ status: "error", access: null, error: result.error.message, data: null });
      return;
    }

    setLoadState({ status: "ready", access, error: null, data: result.data });
  }

  useEffect(() => {
    void load();
  }, [startDate, endDate, reloadKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.amount <= 0 || !form.category.trim()) {
      setActionError("กรุณาระบุประเภทและจำนวนเงินให้ถูกต้อง");
      return;
    }

    setSaving(true);
    setActionError("");
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setActionError("กรุณาเข้าสู่ระบบใหม่");
      setSaving(false);
      return;
    }

    const result = await createAdminFinanceTransaction(supabase, userId, form);
    if (result.error) {
      setActionError(result.error.message);
    } else {
      setForm({ ...emptyForm, transactionDate: form.transactionDate });
      setReloadKey((value) => value + 1);
    }
    setSaving(false);
  }

  async function handleDelete(transaction: AdminFinanceTransaction) {
    if (transaction.reference_id) {
      return;
    }
    if (!window.confirm("ต้องการลบรายการนี้หรือไม่?")) {
      return;
    }

    const supabase = createClient();
    const result = await deleteAdminFinanceTransaction(supabase, transaction.id);
    if (result.error) {
      setActionError(result.error.message);
      return;
    }
    setReloadKey((value) => value + 1);
  }

  const transactions = loadState.status === "ready" ? loadState.data?.transactions ?? [] : [];
  const summary = loadState.status === "ready"
    ? loadState.data?.summary ?? { income: 0, expense: 0, net: 0 }
    : { income: 0, expense: 0, net: 0 };

  const categories = useMemo(
    () => (form.transactionType === "income"
      ? ["ค่าบริการซ่อม", "ขายสินค้า", "รายรับอื่น ๆ"]
      : ["ค่าอะไหล่", "ค่าน้ำมัน", "ค่าไฟ", "เงินเดือนช่าง", "ค่าใช้จ่ายทั่วไป", "ค่าใช้จ่ายอื่น ๆ"]),
    [form.transactionType],
  );

  if (loadState.status === "signed-out") {
    return <div className="p-6">กรุณาเข้าสู่ระบบ</div>;
  }

  if (loadState.status === "denied") {
    return <div className="mx-auto max-w-5xl p-6 text-red-700">ไม่มีสิทธิ์เข้าถึงระบบการเงิน</div>;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-6">
        <p className="text-sm font-semibold text-[var(--brand)]">การเงิน</p>
        <h1 className="mt-1 text-3xl font-bold text-[var(--foreground)]">การเงินอู่ช่างโอ</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">ดูเงินเข้า เงินออก และยอดสุทธิ พร้อมบันทึกรายการค่าใช้จ่ายของอู่</p>
      </header>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm text-emerald-700">เงินเข้าช่วงที่เลือก</p>
          <p className="mt-2 text-2xl font-bold text-emerald-800">{currency.format(summary.income)}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">เงินออกช่วงที่เลือก</p>
          <p className="mt-2 text-2xl font-bold text-red-800">{currency.format(summary.expense)}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-white p-5">
          <p className="text-sm text-[var(--muted)]">เงินสุทธิ</p>
          <p className={`mt-2 text-2xl font-bold ${summary.net >= 0 ? "text-[var(--foreground)]" : "text-red-700"}`}>
            {currency.format(summary.net)}
          </p>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-[var(--line)] bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="text-sm font-semibold">
            ตั้งแต่
            <input className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3 md:w-52" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="text-sm font-semibold">
            ถึง
            <input className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3 md:w-52" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <button className="min-h-10 rounded-md border border-[var(--line)] px-4 text-sm font-semibold" type="button" onClick={() => { setStartDate(today()); setEndDate(today()); }}>
            วันนี้
          </button>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-[var(--line)] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">สรุปจำนวนเงินแต่ละวัน</h2>
          <span className="text-sm text-[var(--muted)]">เงินเข้า - เงินออก = เงินสุทธิ</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          {loadState.status === "ready" && (loadState.data?.daily.length ?? 0) > 0 ? (
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                  <th className="px-3 py-3">วันที่</th>
                  <th className="px-3 py-3 text-right">เงินเข้า</th>
                  <th className="px-3 py-3 text-right">เงินออก</th>
                  <th className="px-3 py-3 text-right">เงินสุทธิ</th>
                </tr>
              </thead>
              <tbody>
                {loadState.data?.daily.map((day) => (
                  <tr className="border-b border-[var(--line)] last:border-0" key={day.date}>
                    <td className="px-3 py-3 font-semibold">{day.date}</td>
                    <td className="px-3 py-3 text-right text-emerald-700">{currency.format(day.income)}</td>
                    <td className="px-3 py-3 text-right text-red-700">{currency.format(day.expense)}</td>
                    <td className={`px-3 py-3 text-right font-bold ${day.net < 0 ? "text-red-700" : "text-[var(--foreground)]"}`}>{currency.format(day.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--muted)]">ยังไม่มีข้อมูลในช่วงวันที่เลือก</p>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="rounded-xl border border-[var(--line)] bg-white p-5">
          <h2 className="text-xl font-bold">เพิ่มรายการเงินเข้า / เงินออก</h2>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold">
              ประเภท
              <select className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3" value={form.transactionType} onChange={(e) => setForm({ ...form, transactionType: e.target.value as AdminFinanceTransactionType, category: e.target.value === "income" ? "รายรับอื่น ๆ" : "ค่าใช้จ่ายทั่วไป" })}>
                <option value="income">เงินเข้า</option>
                <option value="expense">เงินออก</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">
              หมวด
              <select className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              จำนวนเงิน (บาท)
              <input className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3" min="0.01" step="0.01" type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </label>
            <label className="block text-sm font-semibold">
              วันที่
              <input className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3" type="date" value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} />
            </label>
            <label className="block text-sm font-semibold">
              รายละเอียด
              <textarea className="mt-2 min-h-24 w-full rounded-md border border-[var(--line)] px-3 py-2" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            {actionError ? <p className="text-sm text-red-700">{actionError}</p> : null}
            <button className="min-h-11 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">
              {saving ? "กำลังบันทึก..." : "บันทึกรายการ"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">รายการเงินเข้า-ออก</h2>
            <span className="text-sm text-[var(--muted)]">{transactions.length} รายการ</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            {loadState.status === "loading" ? <p className="py-8 text-center text-sm text-[var(--muted)]">กำลังโหลด...</p> : null}
            {loadState.status === "error" ? <p className="py-8 text-center text-sm text-red-700">{loadState.error}</p> : null}
            {loadState.status === "ready" && transactions.length === 0 ? <p className="py-8 text-center text-sm text-[var(--muted)]">ยังไม่มีรายการในช่วงเวลานี้</p> : null}
            {transactions.length > 0 ? (
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]"><th className="px-3 py-3">วันที่</th><th className="px-3 py-3">ประเภท</th><th className="px-3 py-3">หมวด</th><th className="px-3 py-3">รายละเอียด</th><th className="px-3 py-3 text-right">จำนวน</th><th className="px-3 py-3"></th></tr></thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr className="border-b border-[var(--line)] last:border-0" key={transaction.id}>
                      <td className="px-3 py-3">{transaction.transaction_date}</td>
                      <td className={`px-3 py-3 font-semibold ${transaction.transaction_type === "income" ? "text-emerald-700" : "text-red-700"}`}>{transaction.transaction_type === "income" ? "เงินเข้า" : "เงินออก"}</td>
                      <td className="px-3 py-3">{transaction.category}</td>
                      <td className="max-w-xs px-3 py-3 text-[var(--muted)]">{transaction.description ?? "-"}</td>
                      <td className="px-3 py-3 text-right font-semibold">{currency.format(Number(transaction.amount))}</td>
                      <td className="px-3 py-3 text-right">{transaction.reference_id ? <span className="text-xs text-[var(--muted)]">อัตโนมัติ</span> : <button className="text-xs font-semibold text-red-700" type="button" onClick={() => void handleDelete(transaction)}>ลบ</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
