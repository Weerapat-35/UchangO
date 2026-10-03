"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  checkAdminAccess,
  deleteAdminPayroll,
  getAdminPayrolls,
  upsertAdminPayroll,
  type AdminAccessResult,
  type AdminPayroll,
  type AdminPayrollInput,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

const currency = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 2,
});

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

const emptyForm = (month: string): AdminPayrollInput => ({
  baseSalary: 0,
  commissionAmount: 0,
  deductionAmount: 0,
  note: null,
  overtimeAmount: 0,
  payrollMonth: month,
  status: "draft",
  technicianId: "",
});

type LoadState =
  | { status: "loading"; access: null; data: null; error: null }
  | { status: "signed-out"; access: null; data: null; error: null }
  | { status: "denied"; access: Extract<AdminAccessResult, { allowed: false }>; data: null; error: null }
  | { status: "ready"; access: AdminAccessResult; data: Awaited<ReturnType<typeof getAdminPayrolls>>["data"]; error: null }
  | { status: "error"; access: null; data: null; error: string };

export function AdminPayrollPanel() {
  const [month, setMonth] = useState(currentMonth());
  const [loadState, setLoadState] = useState<LoadState>({
    status: "loading",
    access: null,
    data: null,
    error: null,
  });
  const [form, setForm] = useState<AdminPayrollInput>(emptyForm(currentMonth()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  async function load() {
    const supabase = createClient();
    setLoadState({ status: "loading", access: null, data: null, error: null });

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      setLoadState({ status: "error", access: null, data: null, error: sessionError.message });
      return;
    }
    if (!sessionData.session?.user) {
      setLoadState({ status: "signed-out", access: null, data: null, error: null });
      return;
    }

    const access = await checkAdminAccess(supabase, sessionData.session.user.id);
    if (!access.allowed) {
      setLoadState({ status: "denied", access, data: null, error: null });
      return;
    }

    const result = await getAdminPayrolls(supabase, month);
    if (result.error) {
      setLoadState({ status: "error", access: null, data: null, error: result.error.message });
      return;
    }

    setLoadState({ status: "ready", access, data: result.data, error: null });
  }

  useEffect(() => {
    void load();
  }, [month, reloadKey]);

  function editPayroll(payroll: AdminPayroll) {
    setEditingId(payroll.id);
    setForm({
      baseSalary: Number(payroll.base_salary),
      commissionAmount: Number(payroll.commission_amount),
      deductionAmount: Number(payroll.deduction_amount),
      note: payroll.note,
      overtimeAmount: Number(payroll.overtime_amount),
      payrollMonth: payroll.payroll_month,
      status: payroll.status === "paid" ? "paid" : "draft",
      technicianId: payroll.technician_id,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm(month));
    setActionError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.technicianId) {
      setActionError("กรุณาเลือกช่าง");
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

    const result = await upsertAdminPayroll(supabase, userId, {
      ...form,
      payrollMonth: month,
    });

    if (result.error) {
      setActionError(result.error.message);
    } else {
      resetForm();
      setReloadKey((value) => value + 1);
    }
    setSaving(false);
  }

  async function remove(payroll: AdminPayroll) {
    if (payroll.status === "paid") {
      return;
    }
    if (!window.confirm("ต้องการลบรายการเงินเดือนนี้หรือไม่?")) {
      return;
    }

    const supabase = createClient();
    const result = await deleteAdminPayroll(supabase, payroll.id);
    if (result.error) {
      setActionError(result.error.message);
      return;
    }
    if (editingId === payroll.id) {
      resetForm();
    }
    setReloadKey((value) => value + 1);
  }

  const payrolls = loadState.status === "ready" ? loadState.data?.payrolls ?? [] : [];
  const technicians = loadState.status === "ready" ? loadState.data?.technicians ?? [] : [];
  const formNet = Math.max(
    0,
    Number(form.baseSalary) +
      Number(form.overtimeAmount) +
      Number(form.commissionAmount) -
      Number(form.deductionAmount),
  );
  const totalNet = payrolls.reduce((sum, payroll) => sum + Number(payroll.net_salary), 0);

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-6">
        <p className="text-sm font-semibold text-[var(--brand)]">เงินเดือน</p>
        <h1 className="mt-1 text-3xl font-bold text-[var(--foreground)]">เงินเดือนช่าง</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">กำหนดเงินเดือนพื้นฐาน ค่าล่วงเวลา ค่าคอมมิชชั่น และรายการหัก พร้อมบันทึกสถานะการจ่าย</p>
      </header>

      <section className="mb-6 flex flex-col gap-4 rounded-xl border border-[var(--line)] bg-white p-5 md:flex-row md:items-end md:justify-between">
        <label className="text-sm font-semibold">
          เดือนที่ต้องการจัดการ
          <input className="mt-2 min-h-10 rounded-md border border-[var(--line)] px-3" type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(`${e.target.value}-01`)} />
        </label>
        <div className="rounded-lg bg-slate-50 px-5 py-3">
          <p className="text-xs text-[var(--muted)]">เงินเดือนสุทธิรวม</p>
          <p className="mt-1 text-xl font-bold">{currency.format(totalNet)}</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[390px_1fr]">
        <section className="rounded-xl border border-[var(--line)] bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{editingId ? "แก้ไขเงินเดือน" : "เพิ่มเงินเดือน"}</h2>
            {editingId ? <button className="text-sm font-semibold text-[var(--muted)]" type="button" onClick={resetForm}>ยกเลิก</button> : null}
          </div>
          <form className="mt-5 space-y-4" onSubmit={save}>
            <label className="block text-sm font-semibold">
              ช่าง
              <select className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3" value={form.technicianId} onChange={(e) => setForm({ ...form, technicianId: e.target.value })}>
                <option value="">เลือกช่าง</option>
                {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.full_name}</option>)}
              </select>
            </label>
            {[
              ["เงินเดือนพื้นฐาน", "baseSalary"],
              ["OT", "overtimeAmount"],
              ["ค่าคอมมิชชั่น", "commissionAmount"],
              ["รายการหัก", "deductionAmount"],
            ].map(([label, key]) => (
              <label className="block text-sm font-semibold" key={key}>
                {label} (บาท)
                <input className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3" min="0" step="0.01" type="number" value={Number(form[key as "baseSalary" | "overtimeAmount" | "commissionAmount" | "deductionAmount"]) || ""} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) } as AdminPayrollInput)} />
              </label>
            ))}
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-[var(--muted)]">เงินเดือนสุทธิ</p>
              <p className="mt-1 text-2xl font-bold">{currency.format(formNet)}</p>
            </div>
            <label className="block text-sm font-semibold">
              สถานะ
              <select className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] px-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "draft" | "paid" })}>
                <option value="draft">รอจ่าย</option>
                <option value="paid">จ่ายแล้ว</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">
              หมายเหตุ
              <textarea className="mt-2 min-h-20 w-full rounded-md border border-[var(--line)] px-3 py-2" value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </label>
            {actionError ? <p className="text-sm text-red-700">{actionError}</p> : null}
            <button className="min-h-11 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">
              {saving ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "บันทึกเงินเดือน"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">รายการเงินเดือน</h2>
            <span className="text-sm text-[var(--muted)]">{payrolls.length} คน</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            {loadState.status === "loading" ? <p className="py-8 text-center text-sm text-[var(--muted)]">กำลังโหลด...</p> : null}
            {loadState.status === "error" ? <p className="py-8 text-center text-sm text-red-700">{loadState.error}</p> : null}
            {loadState.status === "ready" && technicians.length === 0 ? <p className="py-8 text-center text-sm text-[var(--muted)]">ยังไม่มีบัญชีช่าง</p> : null}
            {payrolls.length > 0 ? (
              <table className="w-full min-w-[900px] text-sm">
                <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]"><th className="px-3 py-3">ช่าง</th><th className="px-3 py-3 text-right">พื้นฐาน</th><th className="px-3 py-3 text-right">OT</th><th className="px-3 py-3 text-right">คอมมิชชั่น</th><th className="px-3 py-3 text-right">หัก</th><th className="px-3 py-3 text-right">สุทธิ</th><th className="px-3 py-3">สถานะ</th><th className="px-3 py-3"></th></tr></thead>
                <tbody>
                  {payrolls.map((payroll) => (
                    <tr className="border-b border-[var(--line)] last:border-0" key={payroll.id}>
                      <td className="px-3 py-3 font-semibold">{payroll.technician?.full_name ?? "-"}</td>
                      <td className="px-3 py-3 text-right">{currency.format(Number(payroll.base_salary))}</td>
                      <td className="px-3 py-3 text-right">{currency.format(Number(payroll.overtime_amount))}</td>
                      <td className="px-3 py-3 text-right">{currency.format(Number(payroll.commission_amount))}</td>
                      <td className="px-3 py-3 text-right">{currency.format(Number(payroll.deduction_amount))}</td>
                      <td className="px-3 py-3 text-right font-bold">{currency.format(Number(payroll.net_salary))}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${payroll.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{payroll.status === "paid" ? "จ่ายแล้ว" : "รอจ่าย"}</span></td>
                      <td className="px-3 py-3 text-right">
                        <button className="mr-2 text-xs font-semibold text-[var(--brand)]" type="button" onClick={() => editPayroll(payroll)}>แก้ไข</button>
                        {payroll.status === "draft" ? <button className="text-xs font-semibold text-red-700" type="button" onClick={() => void remove(payroll)}>ลบ</button> : null}
                      </td>
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
