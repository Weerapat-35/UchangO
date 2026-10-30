"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
import { blockNonDecimalKeys } from "@/lib/validation";

const currency = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 2,
});

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatMonth(value: string) {
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00`);
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(date);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
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

type StatusFilter = "all" | "draft" | "paid";

function SummaryCard({ label, value, detail, tone, icon }: { label: string; value: string; detail: string; tone: "red" | "green" | "amber" | "dark"; icon: string }) {
  const tones = {
    red: "bg-red-50 text-red-700 ring-red-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    dark: "bg-slate-100 text-slate-800 ring-slate-200",
  };
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[var(--foreground)]">{value}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
        </div>
        <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ring-1 ${tones[tone]}`} aria-hidden="true">{icon}</span>
      </div>
    </article>
  );
}

export function AdminPayrollPanel() {
  const [month, setMonth] = useState(currentMonth());
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", access: null, data: null, error: null });
  const [form, setForm] = useState<AdminPayrollInput>(emptyForm(currentMonth()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [workingId, setWorkingId] = useState<string | null>(null);
  // รายการที่รอให้ยืนยันในหน้าต่างยืนยัน (จ่ายแล้ว / ลบ)
  const [pendingAction, setPendingAction] = useState<{ type: "pay" | "delete"; payroll: AdminPayroll } | null>(null);

  useEffect(() => {
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

    void load();
    // reloadKey deliberately reloads the current month after a save/delete action.
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
    setActionError("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm(month));
    setActionError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.technicianId) {
      setActionError("กรุณาเลือกช่างก่อนบันทึก");
      return;
    }
    const amounts = [form.baseSalary, form.overtimeAmount, form.commissionAmount, form.deductionAmount];
    if (amounts.some((amount) => !Number.isFinite(Number(amount)) || Number(amount) < 0)) {
      setActionError("จำนวนเงินต้องเป็นตัวเลขตั้งแต่ 0 บาทขึ้นไป");
      return;
    }

    setSaving(true);
    setActionError("");
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setActionError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      setSaving(false);
      return;
    }

    const result = await upsertAdminPayroll(supabase, userId, { ...form, payrollMonth: month });
    if (result.error) {
      setActionError(result.error.message);
    } else {
      resetForm();
      setReloadKey((value) => value + 1);
    }
    setSaving(false);
  }

  async function remove(payroll: AdminPayroll) {
    if (payroll.status === "paid") return;
    setWorkingId(payroll.id);
    setActionError("");
    const result = await deleteAdminPayroll(createClient(), payroll.id);
    if (result.error) setActionError(result.error.message);
    else {
      if (editingId === payroll.id) resetForm();
      setReloadKey((value) => value + 1);
    }
    setWorkingId(null);
  }

  async function markPaid(payroll: AdminPayroll) {
    if (payroll.status === "paid") return;
    setWorkingId(payroll.id);
    setActionError("");
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setActionError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      setWorkingId(null);
      return;
    }
    const result = await upsertAdminPayroll(supabase, userId, {
      technicianId: payroll.technician_id,
      payrollMonth: payroll.payroll_month,
      baseSalary: Number(payroll.base_salary),
      overtimeAmount: Number(payroll.overtime_amount),
      commissionAmount: Number(payroll.commission_amount),
      deductionAmount: Number(payroll.deduction_amount),
      note: payroll.note,
      status: "paid",
    });
    if (result.error) setActionError(result.error.message);
    else setReloadKey((value) => value + 1);
    setWorkingId(null);
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    if (pendingAction.type === "pay") await markPaid(pendingAction.payroll);
    else await remove(pendingAction.payroll);
    setPendingAction(null);
  }

  const payrolls = useMemo(() => (loadState.status === "ready" ? loadState.data?.payrolls ?? [] : []), [loadState]);
  const technicians = loadState.status === "ready" ? loadState.data?.technicians ?? [] : [];
  const formNet = Math.max(0, Number(form.baseSalary) + Number(form.overtimeAmount) + Number(form.commissionAmount) - Number(form.deductionAmount));
  const totalNet = payrolls.reduce((sum, payroll) => sum + Number(payroll.net_salary), 0);
  const paidPayrolls = payrolls.filter((payroll) => payroll.status === "paid");
  const pendingPayrolls = payrolls.filter((payroll) => payroll.status !== "paid");
  const paidTotal = paidPayrolls.reduce((sum, payroll) => sum + Number(payroll.net_salary), 0);
  const pendingTotal = pendingPayrolls.reduce((sum, payroll) => sum + Number(payroll.net_salary), 0);
  const filteredPayrolls = useMemo(() => payrolls.filter((payroll) => {
    const name = payroll.technician?.full_name ?? "";
    const matchesSearch = name.toLocaleLowerCase("th-TH").includes(search.trim().toLocaleLowerCase("th-TH"));
    const matchesStatus = statusFilter === "all" || (statusFilter === "paid" ? payroll.status === "paid" : payroll.status !== "paid");
    return matchesSearch && matchesStatus;
  }), [payrolls, search, statusFilter]);

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">
            <span className="h-2 w-2 rounded-full bg-[var(--brand)]" /> จัดการเงินเดือนช่าง
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">เงินเดือนช่าง</h2>
        </div>
        <label className="block w-full text-sm font-semibold text-[var(--foreground)] sm:w-auto">
          รอบเงินเดือน
          <input className="mt-2 block min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-medium outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-red-100 sm:w-56" type="month" value={month.slice(0, 7)} onChange={(event) => { const nextMonth = `${event.target.value}-01`; setMonth(nextMonth); setForm(emptyForm(nextMonth)); setEditingId(null); }} />
        </label>
      </header>

      {loadState.status === "signed-out" ? (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบเพื่อจัดการเงินเดือนช่าง</section>
      ) : null}
      {loadState.status === "denied" ? (
        <section className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">บัญชีนี้ไม่มีสิทธิ์เข้าถึงหน้าจัดการเงินเดือน</section>
      ) : null}
      {loadState.status === "error" ? (
        <section className="mb-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"><span>โหลดข้อมูลเงินเดือนไม่สำเร็จ: {loadState.error}</span><button className="rounded-lg border border-red-300 px-4 py-2 font-semibold hover:bg-red-100" type="button" onClick={() => setReloadKey((value) => value + 1)}>ลองอีกครั้ง</button></section>
      ) : null}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="ยอดเงินเดือนสุทธิ" value={currency.format(totalNet)} detail={`${formatMonth(month)} · ${payrolls.length} รายการ`} tone="dark" icon="฿" />
        <SummaryCard label="จ่ายเงินแล้ว" value={currency.format(paidTotal)} detail={`${paidPayrolls.length} คน`} tone="green" icon="✓" />
        <SummaryCard label="รอจ่าย" value={currency.format(pendingTotal)} detail={`${pendingPayrolls.length} คน`} tone="amber" icon="…" />
        <SummaryCard label="ช่างทั้งหมด" value={`${technicians.length} คน`} detail={`${payrolls.length} คนมีรายการในเดือนนี้`} tone="red" icon="♙" />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[370px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
          <div className="border-b border-[var(--line)] bg-slate-50/80 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--brand)]">รายละเอียดเงินเดือน</p>
                <h3 className="mt-1 text-lg font-bold">{editingId ? "แก้ไขรายการเงินเดือน" : "เพิ่มเงินเดือนช่าง"}</h3>
              </div>
              {editingId ? <button className="rounded-lg px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:bg-slate-200" type="button" onClick={resetForm}>ยกเลิก</button> : null}
            </div>
          </div>
          <form className="space-y-4 p-5" onSubmit={save}>
            <label className="block text-sm font-semibold">
              เลือกช่าง <span className="text-red-600">*</span>
              <select required className="mt-2 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 font-normal outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-red-100" value={form.technicianId} onChange={(event) => setForm({ ...form, technicianId: event.target.value })}>
                <option value="">เลือกช่างจากรายชื่อ</option>
                {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.full_name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["เงินเดือนพื้นฐาน", "baseSalary"],
                ["ค่าล่วงเวลา (OT)", "overtimeAmount"],
                ["ค่าคอมมิชชัน / โบนัส", "commissionAmount"],
                ["รายการหัก", "deductionAmount"],
              ] as const).map(([label, key]) => (
                <label className="block text-sm font-semibold" key={key}>
                  <span className="leading-5">{label}</span>
                  <div className="relative mt-2">
                    <input required={key === "baseSalary"} className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 pr-10 text-right font-medium tabular-nums outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-red-100" min="0" onKeyDown={blockNonDecimalKeys} step="0.01" type="number" value={Number(form[key]) || ""} onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) } as AdminPayrollInput)} placeholder="0.00" />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]">฿</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50/70 p-4">
              <div className="flex items-center justify-between gap-3 text-sm text-[var(--muted)]"><span>ยอดสุทธิที่คำนวณได้</span><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-700">เงินเดือนสุทธิ</span></div>
              <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)]">{currency.format(formNet)}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">เงินเดือนพื้นฐาน + ค่าล่วงเวลา + คอมมิชชัน − รายการหัก</p>
            </div>
            <label className="block text-sm font-semibold">
              สถานะการจ่าย
              <select className="mt-2 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 font-normal outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-red-100" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as "draft" | "paid" })}>
                <option value="draft">รอจ่าย</option>
                <option value="paid">จ่ายแล้ว</option>
              </select>
              {form.status === "paid" ? <span className="mt-1 block text-xs font-normal text-amber-700">เลือก “จ่ายแล้ว” เฉพาะเมื่อจ่ายเงินจริงเรียบร้อยแล้ว</span> : null}
            </label>
            <label className="block text-sm font-semibold">
              หมายเหตุ
              <textarea className="mt-2 min-h-20 w-full resize-y rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-normal outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-red-100" value={form.note ?? ""} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="เช่น โบนัสประจำเดือน หรือรายละเอียดการหัก" />
            </label>
            {actionError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p> : null}
            <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-bold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving || loadState.status !== "ready" || technicians.length === 0} type="submit">
              <span aria-hidden="true">{saving ? "◌" : "＋"}</span>{saving ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "บันทึกเงินเดือน"}
            </button>
            {!editingId ? <p className="text-center text-xs leading-5 text-[var(--muted)]">หนึ่งช่างมีรายการได้หนึ่งรายการต่อหนึ่งเดือน การบันทึกซ้ำจะอัปเดตรายการเดิม</p> : null}
          </form>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
          <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--brand)]">ทะเบียนเงินเดือน</p>
                <h3 className="mt-1 text-lg font-bold">รายการเงินเดือน</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">รอบ {formatMonth(month)}</p>
              </div>
              <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{filteredPayrolls.length} รายการ</span>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="relative block min-w-0 flex-1">
                <span className="sr-only">ค้นหาช่าง</span>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true">⌕</span>
                <input className="min-h-10 w-full rounded-xl border border-[var(--line)] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-red-100" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อช่าง..." />
              </label>
              <select aria-label="กรองสถานะการจ่าย" className="min-h-10 rounded-xl border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--brand)]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">ทุกสถานะ</option><option value="draft">รอจ่าย</option><option value="paid">จ่ายแล้ว</option>
              </select>
            </div>
          </div>

          {loadState.status === "loading" ? <div className="p-12 text-center text-sm text-[var(--muted)]"><span className="mb-3 block text-2xl">◌</span>กำลังโหลดข้อมูลเงินเดือน...</div> : null}
          {loadState.status === "ready" && technicians.length === 0 ? <div className="p-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl">♙</span><p className="mt-3 font-semibold">ยังไม่มีบัญชีช่าง</p><p className="mt-1 text-sm text-[var(--muted)]">เพิ่มบัญชีช่างก่อน จึงจะสามารถจัดการเงินเดือนได้</p></div> : null}
          {loadState.status === "ready" && technicians.length > 0 && filteredPayrolls.length === 0 ? <div className="p-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl">฿</span><p className="mt-3 font-semibold">ไม่พบรายการเงินเดือน</p><p className="mt-1 text-sm text-[var(--muted)]">ลองเปลี่ยนเดือน ตัวกรอง หรือเพิ่มรายการเงินเดือนใหม่</p></div> : null}
          {filteredPayrolls.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-[var(--muted)]">
                  <tr className="border-b border-[var(--line)] text-left"><th className="px-4 py-3">ช่าง</th><th className="px-3 py-3 text-right">พื้นฐาน</th><th className="px-3 py-3 text-right">ค่าล่วงเวลา</th><th className="px-3 py-3 text-right">คอมมิชชัน</th><th className="px-3 py-3 text-right">หัก</th><th className="px-3 py-3 text-right">ยอดสุทธิ</th><th className="px-3 py-3">สถานะ</th><th className="px-4 py-3 text-right">จัดการ</th></tr>
                </thead>
                <tbody>
                  {filteredPayrolls.map((payroll) => (
                    <tr className="border-b border-[var(--line)] last:border-0 hover:bg-slate-50/70" key={payroll.id}>
                      <td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">{(payroll.technician?.full_name ?? "ช").trim().slice(0, 1)}</span><div><p className="font-semibold text-[var(--foreground)]">{payroll.technician?.full_name ?? "ไม่พบชื่อช่าง"}</p><p className="mt-1 text-[11px] text-[var(--muted)]">บันทึก {formatDate(payroll.updated_at || payroll.created_at)}</p></div></div></td>
                      <td className="px-3 py-4 text-right tabular-nums">{currency.format(Number(payroll.base_salary))}</td>
                      <td className="px-3 py-4 text-right tabular-nums">{currency.format(Number(payroll.overtime_amount))}</td>
                      <td className="px-3 py-4 text-right tabular-nums">{currency.format(Number(payroll.commission_amount))}</td>
                      <td className="px-3 py-4 text-right tabular-nums text-red-700">{Number(payroll.deduction_amount) > 0 ? `−${currency.format(Number(payroll.deduction_amount))}` : currency.format(0)}</td>
                      <td className="px-3 py-4 text-right font-bold tabular-nums">{currency.format(Number(payroll.net_salary))}</td>
                      <td className="px-3 py-4"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-bold ${payroll.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}><span className={`h-1.5 w-1.5 rounded-full ${payroll.status === "paid" ? "bg-emerald-500" : "bg-amber-500"}`} />{payroll.status === "paid" ? "จ่ายแล้ว" : "รอจ่าย"}</span>{payroll.status === "paid" && payroll.paid_at ? <p className="mt-1 text-[10px] text-[var(--muted)]">{formatDate(payroll.paid_at)}</p> : null}</td>
                      <td className="px-4 py-4"><div className="flex items-center justify-end gap-2"><button className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs font-semibold hover:border-red-200 hover:bg-red-50 hover:text-red-700" type="button" onClick={() => editPayroll(payroll)}>แก้ไข</button>{payroll.status !== "paid" ? <><button className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50" disabled={workingId === payroll.id} type="button" onClick={() => setPendingAction({ type: "pay", payroll })}>{workingId === payroll.id ? "..." : "จ่ายแล้ว"}</button><button aria-label={`ลบเงินเดือน ${payroll.technician?.full_name ?? "ช่าง"}`} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50" disabled={workingId === payroll.id} type="button" onClick={() => setPendingAction({ type: "delete", payroll })}>ลบ</button></> : null}</div></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/80"><tr><td colSpan={5} className="px-4 py-4 text-right font-semibold text-[var(--muted)]">รวมยอดสุทธิที่แสดง</td><td className="px-3 py-4 text-right font-bold tabular-nums">{currency.format(filteredPayrolls.reduce((sum, payroll) => sum + Number(payroll.net_salary), 0))}</td><td colSpan={2} /></tr></tfoot>
              </table>
            </div>
          ) : null}
          {actionError && loadState.status !== "ready" ? <p className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">{actionError}</p> : null}
        </section>
      </div>

      {pendingAction?.type === "pay" ? (
        <ConfirmDialog
          cancelLabel="ยังไม่จ่าย"
          confirmLabel="ยืนยันจ่ายแล้ว"
          description={`ยืนยันว่าจ่ายเงินเดือนให้ ${pendingAction.payroll.technician?.full_name ?? "ช่างคนนี้"} จำนวน ${currency.format(Number(pendingAction.payroll.net_salary))} แล้วหรือไม่? กรุณาตรวจสอบว่าโอนเงินจริงแล้วก่อนยืนยัน`}
          isLoading={workingId === pendingAction.payroll.id}
          loadingLabel="กำลังบันทึก..."
          onCancel={() => setPendingAction(null)}
          onConfirm={() => void confirmPendingAction()}
          open
          title="ยืนยันการจ่ายเงินเดือน?"
          variant="primary"
        />
      ) : null}

      {pendingAction?.type === "delete" ? (
        <ConfirmDialog
          description={`รายการเงินเดือนของ ${pendingAction.payroll.technician?.full_name ?? "ช่างคนนี้"} เดือน${formatMonth(pendingAction.payroll.payroll_month)} จะถูกลบถาวรและไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่?`}
          isLoading={workingId === pendingAction.payroll.id}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => void confirmPendingAction()}
          open
          title="ลบรายการเงินเดือนนี้?"
        />
      ) : null}
    </main>
  );
}
