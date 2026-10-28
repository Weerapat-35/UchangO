"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  checkAdminAccess,
  createAdminFinanceTransaction,
  createAdminRecurringExpense,
  deleteAdminFinanceTransaction,
  deleteAdminRecurringExpense,
  generateAdminRecurringExpenses,
  getAdminFinanceTransactions,
  getAdminRecurringExpenses,
  setAdminRecurringExpenseActive,
  type AdminAccessResult,
  type AdminFinanceTransaction,
  type AdminFinanceTransactionInput,
  type AdminFinanceTransactionType,
  type AdminRecurringExpense,
  type AdminRecurringExpenseInput,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";
import { blockNonDecimalKeys } from "@/lib/validation";

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

const INCOME_CATEGORIES = ["ค่าบริการซ่อม", "ขายสินค้า", "รายรับอื่น ๆ"];
const EXPENSE_CATEGORIES = ["ค่าอะไหล่", "ค่าน้ำมัน", "ค่าไฟ", "ค่าน้ำ", "ค่าเช่า", "ค่าอินเทอร์เน็ต", "เงินเดือนช่าง", "ค่าใช้จ่ายทั่วไป", "ค่าใช้จ่ายอื่น ๆ"];

// รายการอัตโนมัติที่แอดมินลบได้ (ลบแล้วระบบไม่สร้างซ้ำ) ส่วนรายรับจากการชำระเงินและเงินเดือนลบได้จากต้นทางเท่านั้น
const DELETABLE_AUTO_REFERENCES = ["recurring_expense", "inventory_movement"];

const AUTO_REFERENCE_LABELS: Record<string, string> = {
  booking_payment: "อัตโนมัติ: ชำระค่าบริการ",
  inventory_movement: "อัตโนมัติ: รับเข้าสต็อก",
  product_payment: "อัตโนมัติ: ขายสินค้า",
  recurring_expense: "อัตโนมัติ: ค่าใช้จ่ายประจำ",
  technician_payroll: "อัตโนมัติ: เงินเดือนช่าง",
};

const emptyRecurringForm: AdminRecurringExpenseInput = {
  amount: 0,
  category: "ค่าเช่า",
  dayOfMonth: 1,
  name: "",
};

type PendingDelete =
  | { type: "transaction"; transaction: AdminFinanceTransaction }
  | { type: "recurring"; recurring: AdminRecurringExpense };

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
  const [recurringExpenses, setRecurringExpenses] = useState<AdminRecurringExpense[]>([]);
  const [recurringError, setRecurringError] = useState("");
  const [recurringForm, setRecurringForm] = useState<AdminRecurringExpenseInput>(emptyRecurringForm);
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
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

      // บันทึกค่าใช้จ่ายประจำที่ถึงกำหนดก่อน แล้วค่อยโหลดรายการ จะได้เห็นยอดล่าสุด
      const generated = await generateAdminRecurringExpenses(supabase);
      const [result, recurringResult] = await Promise.all([
        getAdminFinanceTransactions(supabase, startDate, endDate),
        getAdminRecurringExpenses(supabase),
      ]);
      if (result.error) {
        setLoadState({ status: "error", access: null, error: result.error.message, data: null });
        return;
      }

      const recurringLoadError = generated.error ?? recurringResult.error;
      setRecurringError(
        recurringLoadError
          ? `ใช้ค่าใช้จ่ายประจำไม่ได้: ${recurringLoadError.message} (ตรวจว่ารัน supabase/20261028_auto_expenses.sql แล้ว)`
          : "",
      );
      setRecurringExpenses(recurringResult.data ?? []);
      setLoadState({ status: "ready", access, error: null, data: result.data });
    }

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

  function canDelete(transaction: AdminFinanceTransaction) {
    return !transaction.reference_id || DELETABLE_AUTO_REFERENCES.includes(transaction.reference_type ?? "");
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setActionError("");
    const supabase = createClient();
    const result = pendingDelete.type === "transaction"
      ? await deleteAdminFinanceTransaction(supabase, pendingDelete.transaction.id)
      : await deleteAdminRecurringExpense(supabase, pendingDelete.recurring.id);
    if (result.error) {
      setActionError(result.error.message);
    } else {
      setReloadKey((value) => value + 1);
    }
    setDeleting(false);
    setPendingDelete(null);
  }

  async function handleRecurringSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recurringForm.name.trim() || recurringForm.amount <= 0) {
      setRecurringError("กรุณาระบุชื่อรายการและจำนวนเงินให้ถูกต้อง");
      return;
    }

    setRecurringSaving(true);
    setRecurringError("");
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setRecurringError("กรุณาเข้าสู่ระบบใหม่");
      setRecurringSaving(false);
      return;
    }

    const result = await createAdminRecurringExpense(supabase, userId, recurringForm);
    if (result.error) {
      setRecurringError(result.error.message);
    } else {
      setRecurringForm(emptyRecurringForm);
      setReloadKey((value) => value + 1);
    }
    setRecurringSaving(false);
  }

  async function toggleRecurring(recurring: AdminRecurringExpense) {
    const result = await setAdminRecurringExpenseActive(createClient(), recurring.id, !recurring.is_active);
    if (result.error) {
      setRecurringError(result.error.message);
      return;
    }
    setReloadKey((value) => value + 1);
  }

  const transactions = loadState.status === "ready" ? loadState.data?.transactions ?? [] : [];
  const summary = loadState.status === "ready"
    ? loadState.data?.summary ?? { income: 0, expense: 0, net: 0 }
    : { income: 0, expense: 0, net: 0 };

  const categories = useMemo(
    () => (form.transactionType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES),
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
        <h1 className="mt-1 text-3xl font-bold text-[var(--foreground)]">การเงิน</h1>
        
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
              <input className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3" min="0.01" onKeyDown={blockNonDecimalKeys} step="0.01" type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
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
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          {transaction.reference_type ? <span className="whitespace-nowrap text-xs text-[var(--muted)]">{AUTO_REFERENCE_LABELS[transaction.reference_type] ?? "อัตโนมัติ"}</span> : null}
                          {canDelete(transaction) ? <button className="text-xs font-semibold text-red-700" type="button" onClick={() => setPendingDelete({ type: "transaction", transaction })}>ลบ</button> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">ค่าใช้จ่ายประจำเดือน</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              ตั้งไว้ครั้งเดียว ระบบบันทึกเป็นเงินออกให้ทุกเดือนเมื่อถึงวันที่กำหนด (บันทึกตอนเปิดหน้าการเงิน)
            </p>
          </div>
          <span className="text-sm text-[var(--muted)]">
            รวมต่อเดือน {currency.format(recurringExpenses.filter((item) => item.is_active).reduce((sum, item) => sum + Number(item.amount), 0))}
          </span>
        </div>

        <form className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_150px_130px_auto] md:items-end" onSubmit={handleRecurringSubmit}>
          <label className="text-sm font-semibold">
            ชื่อรายการ
            <input className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3" placeholder="เช่น ค่าเช่าอู่" value={recurringForm.name} onChange={(e) => setRecurringForm({ ...recurringForm, name: e.target.value })} />
          </label>
          <label className="text-sm font-semibold">
            หมวด
            <select className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3" value={recurringForm.category} onChange={(e) => setRecurringForm({ ...recurringForm, category: e.target.value })}>
              {EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            จำนวนเงิน (บาท)
            <input className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3" min="0.01" onKeyDown={blockNonDecimalKeys} step="0.01" type="number" value={recurringForm.amount || ""} onChange={(e) => setRecurringForm({ ...recurringForm, amount: Number(e.target.value) })} />
          </label>
          <label className="text-sm font-semibold">
            ทุกวันที่
            <select className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3" value={recurringForm.dayOfMonth} onChange={(e) => setRecurringForm({ ...recurringForm, dayOfMonth: Number(e.target.value) })}>
              {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}
            </select>
          </label>
          <button className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={recurringSaving} type="submit">
            {recurringSaving ? "กำลังบันทึก..." : "เพิ่มรายการ"}
          </button>
        </form>
        {recurringError ? <p className="mt-3 text-sm text-red-700">{recurringError}</p> : null}

        <div className="mt-5 overflow-x-auto">
          {recurringExpenses.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">ยังไม่มีค่าใช้จ่ายประจำ</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]"><th className="px-3 py-3">รายการ</th><th className="px-3 py-3">หมวด</th><th className="px-3 py-3">ทุกวันที่</th><th className="px-3 py-3 text-right">จำนวน</th><th className="px-3 py-3">สถานะ</th><th className="px-3 py-3"></th></tr></thead>
              <tbody>
                {recurringExpenses.map((item) => (
                  <tr className={`border-b border-[var(--line)] last:border-0 ${item.is_active ? "" : "text-[var(--muted)]"}`} key={item.id}>
                    <td className="px-3 py-3 font-semibold">{item.name}</td>
                    <td className="px-3 py-3">{item.category}</td>
                    <td className="px-3 py-3">{item.day_of_month} ของทุกเดือน</td>
                    <td className="px-3 py-3 text-right font-semibold">{currency.format(Number(item.amount))}</td>
                    <td className="px-3 py-3">{item.is_active ? <span className="text-emerald-700">ใช้งาน</span> : "หยุดชั่วคราว"}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button className="text-xs font-semibold text-[var(--foreground)]" type="button" onClick={() => void toggleRecurring(item)}>{item.is_active ? "หยุด" : "เปิดใช้"}</button>
                        <button className="text-xs font-semibold text-red-700" type="button" onClick={() => setPendingDelete({ type: "recurring", recurring: item })}>ลบ</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <ConfirmDialog
        description={
          pendingDelete?.type === "recurring"
            ? `"${pendingDelete.recurring.name}" จะไม่ถูกบันทึกในเดือนต่อ ๆ ไป รายการเงินออกที่บันทึกไปแล้วยังอยู่ในหน้าการเงิน คุณแน่ใจหรือไม่?`
            : pendingDelete?.type === "transaction"
              ? `รายการ${pendingDelete.transaction.transaction_type === "income" ? "เงินเข้า" : "เงินออก"} "${pendingDelete.transaction.category}" ${currency.format(Number(pendingDelete.transaction.amount))} จะถูกลบถาวรและไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่?`
              : ""
        }
        isLoading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
        open={pendingDelete !== null}
        title={pendingDelete?.type === "recurring" ? "ลบค่าใช้จ่ายประจำนี้?" : "ลบรายการนี้?"}
      />
    </main>
  );
}
