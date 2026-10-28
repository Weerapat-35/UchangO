"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { SignInPrompt } from "@/components/sign-in-prompt";
import {
  AdminIcon,
  AdminToast,
  adminInputClass,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/features/admin/components/admin-list-ui";
import {
  getTechnicianProfile,
  getTechnicianWorkOrders,
  updateTechnicianProfile,
  type TechnicianProfile,
  type TechnicianWorkOrder,
} from "@/features/technician";
import { createClient } from "@/lib/supabase/browser";
import { isValidThaiPhone, normalizeThaiPhone } from "@/lib/validation";

type ReadyProfile = Extract<TechnicianProfile, { allowed: true }>;

type LoadState =
  | { status: "loading" | "signed-out"; message: null; profile: null; userId: null }
  | { status: "error" | "denied"; message: string; profile: null; userId: null }
  | { status: "ready"; message: null; profile: ReadyProfile; userId: string };

type Draft = { fullName: string; phoneNumber: string; specialty: string; skillIds: string[] };

function toDraft(profile: ReadyProfile): Draft {
  return {
    fullName: profile.profile.full_name,
    phoneNumber: profile.profile.phone_number,
    specialty: profile.profile.technician_specialty ?? "",
    skillIds: [...profile.selectedSkillIds].sort(),
  };
}

function isSameDraft(a: Draft, b: Draft) {
  return a.fullName === b.fullName && a.phoneNumber === b.phoneNumber && a.specialty === b.specialty && a.skillIds.join() === b.skillIds.join();
}

function initials(name: string) {
  return (name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("") || "ช").toUpperCase();
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-3">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-white/70">{label}</p>
    </div>
  );
}

export function TechnicianProfilePanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", message: null, profile: null, userId: null });
  const [workOrders, setWorkOrders] = useState<TechnicianWorkOrder[]>([]);
  const [draft, setDraft] = useState<Draft>({ fullName: "", phoneNumber: "", specialty: "", skillIds: [] });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadProfile() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) return setLoadState({ status: "error", message: sessionError.message, profile: null, userId: null });
      if (!session?.user) return setLoadState({ status: "signed-out", message: null, profile: null, userId: null });

      const [profileResult, workOrdersResult] = await Promise.all([
        getTechnicianProfile(supabase, session.user.id),
        getTechnicianWorkOrders(supabase, session.user.id),
      ]);
      if (!isMounted) return;
      if (profileResult.error || !profileResult.data) {
        return setLoadState({ status: "error", message: profileResult.error?.message ?? "โหลดโปรไฟล์ไม่สำเร็จ", profile: null, userId: null });
      }
      if (!profileResult.data.allowed) return setLoadState({ status: "denied", message: profileResult.data.reason, profile: null, userId: null });

      setWorkOrders(workOrdersResult.data?.allowed ? workOrdersResult.data.workOrders : []);
      setDraft(toDraft(profileResult.data));
      setAvatarUrl(profileResult.data.profile.avatar_url ?? null);
      setLoadState({ status: "ready", message: null, profile: profileResult.data, userId: session.user.id });
    }

    void loadProfile();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void loadProfile(); });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: workOrders.length,
      active: workOrders.filter((order) => order.status === "assigned" || order.status === "in_progress").length,
      completedThisMonth: workOrders.filter((order) => {
        if (order.status !== "completed" || !order.completed_at) return false;
        const completed = new Date(order.completed_at);
        return completed.getFullYear() === now.getFullYear() && completed.getMonth() === now.getMonth();
      }).length,
    };
  }, [workOrders]);

  const profile = loadState.status === "ready" ? loadState.profile : null;
  const dirty = profile ? !isSameDraft(draft, toDraft(profile)) : false;

  function toggleSkill(skillId: string) {
    setFormError("");
    setDraft((current) => ({
      ...current,
      skillIds: (current.skillIds.includes(skillId) ? current.skillIds.filter((id) => id !== skillId) : [...current.skillIds, skillId]).sort(),
    }));
  }

  async function uploadAvatar(file: File) {
    if (loadState.status !== "ready") return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setToast({ message: "รองรับเฉพาะรูป JPG, PNG และ WebP", tone: "error" });
    if (file.size > 2 * 1024 * 1024) return setToast({ message: "รูปภาพต้องมีขนาดไม่เกิน 2 MB", tone: "error" });

    setUploadingAvatar(true);
    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${loadState.userId}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, cacheControl: "3600" });
    if (uploadError) {
      setUploadingAvatar(false);
      return setToast({ message: uploadError.message, tone: "error" });
    }
    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
    const { data, error } = await supabase.from("profiles").update({ avatar_url: publicData.publicUrl }).eq("id", loadState.userId).select("*").single();
    setUploadingAvatar(false);
    if (error) return setToast({ message: error.message, tone: "error" });
    setAvatarUrl(publicData.publicUrl);
    setLoadState({ ...loadState, profile: { ...loadState.profile, profile: data } });
    setToast({ message: "เปลี่ยนรูปโปรไฟล์แล้ว", tone: "success" });
  }

  async function handleSave(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (loadState.status !== "ready") return;
    if (!draft.fullName.trim()) return setFormError("กรุณากรอกชื่อ-นามสกุล");
    if (!draft.phoneNumber.trim()) return setFormError("กรุณากรอกเบอร์โทรศัพท์");
    if (!isValidThaiPhone(draft.phoneNumber)) return setFormError("เบอร์โทรศัพท์ต้องมี 10 หลักและขึ้นต้นด้วย 0");

    setSaving(true);
    setFormError("");
    const { data, error } = await updateTechnicianProfile(createClient(), {
      fullName: draft.fullName.trim(),
      phoneNumber: draft.phoneNumber.trim(),
      selectedSkillIds: draft.skillIds,
      technicianSpecialty: draft.specialty.trim() || null,
      userId: loadState.userId,
    });
    setSaving(false);
    if (error) return setFormError(error.message);
    if (data?.allowed) {
      setDraft(toDraft(data));
      setLoadState({ ...loadState, profile: data });
    }
    setToast({ message: "บันทึกโปรไฟล์แล้ว", tone: "success" });
  }

  if (loadState.status === "loading") {
    return (
      <div className="grid place-items-center py-24 text-sm text-[var(--muted)]">
        <span className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--brand)]" aria-hidden="true" />
        กำลังโหลดโปรไฟล์...
      </div>
    );
  }
  if (loadState.status === "signed-out") {
    return <div className="grid place-items-center py-16"><SignInPrompt message="กรุณาเข้าสู่ระบบด้วยบัญชีช่าง" showSignUp={false} title="กรุณาเข้าสู่ระบบ" /></div>;
  }
  if (loadState.status !== "ready" || !profile) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-sm leading-6 text-red-700">
        <p className="font-semibold">{loadState.status === "denied" ? "ไม่มีสิทธิ์เข้าถึง" : "โหลดโปรไฟล์ไม่สำเร็จ"}</p>
        <p className="mt-1">{loadState.message}</p>
      </div>
    );
  }

  const selectedCount = draft.skillIds.length;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 pb-28 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl bg-[var(--color-asphalt)] text-white shadow-sm">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <button
            aria-label="เปลี่ยนรูปโปรไฟล์"
            className="group relative h-28 w-28 shrink-0 self-center overflow-hidden rounded-full ring-4 ring-white/15 sm:self-auto"
            disabled={uploadingAvatar}
            onClick={() => avatarInputRef.current?.click()}
            type="button"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- รูปโปรไฟล์จาก Supabase storage
              <img alt="รูปโปรไฟล์ช่าง" className="h-full w-full object-cover" src={avatarUrl} />
            ) : (
              <span className="grid h-full w-full place-items-center bg-[var(--color-safety)] text-3xl font-bold">{initials(draft.fullName)}</span>
            )}
            <span className={`absolute inset-x-0 bottom-0 bg-black/55 py-1.5 text-center text-xs font-semibold transition ${uploadingAvatar ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
              {uploadingAvatar ? "กำลังอัปโหลด..." : "เปลี่ยนรูป"}
            </span>
          </button>
          <input
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); event.currentTarget.value = ""; }}
            ref={avatarInputRef}
            type="file"
          />

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <span className="inline-flex rounded-full bg-[var(--color-safety)] px-3 py-1 text-xs font-bold">ช่างประจำอู่</span>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{profile.profile.full_name || "ยังไม่ระบุชื่อ"}</h1>
            <p className="mt-1 text-sm text-white/70">{profile.profile.technician_specialty || "ยังไม่ได้ระบุความถนัด"}</p>
            <p className="mt-2 text-xs text-white/50">{profile.profile.email ?? ""}{profile.profile.phone_number ? ` · ${profile.profile.phone_number}` : ""}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-white/10 px-6 py-4 sm:px-8">
          <Stat label="งานทั้งหมด" value={stats.total} />
          <Stat label="กำลังทำอยู่" value={stats.active} />
          <Stat label="เสร็จเดือนนี้" value={stats.completedThisMonth} />
        </div>
      </section>

      <form className="space-y-5" onSubmit={(event) => void handleSave(event)}>
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-[var(--foreground)]">ข้อมูลส่วนตัว</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">ชื่อและเบอร์โทรจะแสดงให้แอดมินเห็นตอนมอบหมายงาน</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className={adminLabelClass}>
              ชื่อ-นามสกุล
              <input className={adminInputClass} onChange={(event) => { setFormError(""); setDraft({ ...draft, fullName: event.target.value }); }} value={draft.fullName} />
            </label>
            <label className={adminLabelClass}>
              เบอร์โทรศัพท์
              <input className={adminInputClass} inputMode="numeric" onChange={(event) => { setFormError(""); setDraft({ ...draft, phoneNumber: normalizeThaiPhone(event.target.value) }); }} placeholder="08xxxxxxxx" value={draft.phoneNumber} />
            </label>
            <label className={`${adminLabelClass} sm:col-span-2`}>
              ความถนัดหลัก <span className="font-normal text-[var(--muted)]">(สั้น ๆ)</span>
              <input className={adminInputClass} onChange={(event) => setDraft({ ...draft, specialty: event.target.value })} placeholder="เช่น ระบบไฟฟ้าและการวิเคราะห์อาการ" value={draft.specialty} />
            </label>
            <div className={`${adminLabelClass} sm:col-span-2`}>
              อีเมลที่ใช้เข้าสู่ระบบ
              <p className="mt-1.5 flex min-h-11 items-center rounded-xl bg-[var(--color-concrete)] px-3.5 text-sm font-normal text-[var(--muted)]">{profile.profile.email ?? "-"}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[var(--foreground)]">ทักษะ</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">เลือกงานที่ถนัด แอดมินใช้ข้อมูลนี้ตอนมอบหมายงานซ่อม</p>
            </div>
            <span className="text-sm text-[var(--muted)]">เลือกแล้ว <span className="font-bold text-[var(--foreground)]">{selectedCount}</span> ทักษะ</span>
          </div>

          {profile.skills.length === 0 ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">ยังไม่มีทักษะที่เปิดใช้งาน ให้แอดมินเพิ่มที่หน้าทักษะช่าง</p>
          ) : (
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {profile.skills.map((skill) => {
                const checked = draft.skillIds.includes(skill.id);
                return (
                  <button
                    aria-pressed={checked}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${checked ? "border-[var(--color-safety)] bg-red-50/60 ring-2 ring-red-50" : "border-[var(--line)] bg-white hover:border-slate-300"}`}
                    key={skill.id}
                    onClick={() => toggleSkill(skill.id)}
                    type="button"
                  >
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${checked ? "border-[var(--color-safety)] bg-[var(--color-safety)] text-white" : "border-slate-300"}`} aria-hidden="true">
                      {checked ? <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24"><path d="m5 12 4.5 4.5L19 7" /></svg> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-[var(--foreground)]">{skill.name}</span>
                      {skill.description ? <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">{skill.description}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white px-5 py-4 text-sm shadow-sm">
          <p className="text-[var(--muted)]">ดูงานที่ได้รับมอบหมายทั้งหมด</p>
          <Link className="inline-flex items-center gap-1 font-semibold text-[var(--color-safety)] hover:underline" href="/technician/work-orders">
            ไปที่ใบงานของฉัน <AdminIcon name="chevron" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </form>

      {dirty || formError ? (
        <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-[var(--line)] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:left-[264px]">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--foreground)]">
              {formError ? <span className="text-red-700">{formError}</span> : "มีการแก้ไขที่ยังไม่บันทึก"}
            </p>
            <div className="flex gap-2">
              <button className={adminSecondaryButtonClass} disabled={saving} onClick={() => { setFormError(""); setDraft(toDraft(profile)); }} type="button">ยกเลิก</button>
              <button className={adminPrimaryButtonClass} disabled={saving || !dirty} onClick={() => void handleSave()} type="button">{saving ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}</button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminToast message={toast?.message ?? null} onDone={clearToast} tone={toast?.tone} />
    </main>
  );
}
