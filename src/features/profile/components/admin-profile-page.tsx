"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/database.types";

type AdminProfile = Database["public"]["Tables"]["profiles"]["Row"];
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AD";
}

export function AdminProfilePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadProfile() {
      setLoading(true); setError("");
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setProfile(null); setError("กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบก่อน"); setLoading(false); return;
      }
      const { data, error: queryError } = await supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle();
      if (queryError) {
        setProfile(null); setError(`โหลดข้อมูลไม่สำเร็จ: ${queryError.message}`); setLoading(false); return;
      }
      if (!data || !["admin", "administrator"].includes(String(data.role ?? "").toLowerCase())) {
        setProfile(null); setError("บัญชีนี้ไม่มีสิทธิ์เข้าถึงหน้าโปรไฟล์ผู้ดูแลระบบ"); setLoading(false); return;
      }
      const normalized = { ...data, email: data.email ?? authData.user.email ?? null };
      setProfile(normalized); setName(normalized.full_name ?? ""); setPhone(normalized.phone_number ?? ""); setLoading(false);
    }

    void loadProfile();
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName) { setError("กรุณากรอกชื่อ-นามสกุล"); setSuccess(""); return; }
    if (cleanPhone && !/^0\d{9}$/.test(cleanPhone)) { setError("เบอร์โทรศัพท์ต้องมี 10 หลักและขึ้นต้นด้วย 0"); setSuccess(""); return; }
    setSaving(true); setError(""); setSuccess("");
    const supabase = createClient();
    const { data, error: updateError } = await supabase.from("profiles").update({ full_name: cleanName, phone_number: cleanPhone }).eq("id", profile.id).select("*").single();
    if (updateError) setError(`บันทึกไม่สำเร็จ: ${updateError.message}`);
    else { setProfile({ ...data, email: data.email ?? profile.email }); setName(data.full_name); setPhone(data.phone_number ?? ""); setSuccess("บันทึกข้อมูลโปรไฟล์ลง Supabase แล้ว"); }
    setSaving(false);
  }

  async function uploadAvatar(file: File) {
    if (!profile) return;
    setError(""); setSuccess("");
    if (!ACCEPTED_TYPES.includes(file.type)) { setError("รองรับเฉพาะไฟล์ JPG, PNG และ WebP"); return; }
    if (file.size > MAX_FILE_SIZE) { setError("รูปภาพต้องมีขนาดไม่เกิน 2 MB"); return; }
    setUploading(true);
    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${profile.id}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (uploadError) { setError(`อัปโหลดรูปไม่สำเร็จ: ${uploadError.message}`); setUploading(false); return; }
    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
    const { data, error: updateError } = await supabase.from("profiles").update({ avatar_url: publicData.publicUrl }).eq("id", profile.id).select("*").single();
    if (updateError) {
      await supabase.storage.from("avatars").remove([path]);
      setError(`บันทึกรูปโปรไฟล์ไม่สำเร็จ: ${updateError.message}`);
    } else { setProfile({ ...data, email: data.email ?? profile.email }); setSuccess("อัปเดตรูปโปรไฟล์และบันทึกลง Supabase แล้ว"); }
    setUploading(false);
  }

  async function removeAvatar() {
    if (!profile?.avatar_url) return;
    setUploading(true); setError(""); setSuccess("");
    const supabase = createClient();
    const marker = "/storage/v1/object/public/avatars/";
    const index = profile.avatar_url.indexOf(marker);
    const oldPath = index >= 0 ? decodeURIComponent(profile.avatar_url.slice(index + marker.length)) : null;
    const { data, error: updateError } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", profile.id).select("*").single();
    if (updateError) setError(`ลบรูปโปรไฟล์ไม่สำเร็จ: ${updateError.message}`);
    else {
      setProfile({ ...data, email: data.email ?? profile.email });
      if (oldPath) {
        const { error: removeError } = await supabase.storage.from("avatars").remove([oldPath]);
        if (removeError) setError("ลบรูปโปรไฟล์แล้ว แต่ลบไฟล์เดิมออกจากที่เก็บไฟล์ไม่สำเร็จ");
        else setSuccess("ลบรูปโปรไฟล์แล้ว");
      } else setSuccess("ลบรูปโปรไฟล์แล้ว");
    }
    setUploading(false);
  }

  if (loading) return <main className="admin-profile-page"><div className="admin-profile-card admin-profile-loading">กำลังโหลดข้อมูลผู้ดูแลระบบ...</div></main>;
  if (!profile) return <main className="admin-profile-page"><section className="admin-profile-card"><p className="admin-profile-eyebrow">บัญชีผู้ดูแลระบบ</p><h1>โปรไฟล์ผู้ดูแลระบบ</h1><div className="admin-profile-alert admin-profile-alert--error">{error || "ไม่สามารถโหลดโปรไฟล์ได้"}</div><button className="admin-profile-button" onClick={() => router.push("/auth")}>ไปหน้าเข้าสู่ระบบ</button></section></main>;

  return <main className="admin-profile-page">
    <header className="admin-profile-heading"><div><p className="admin-profile-eyebrow">ตั้งค่าบัญชี</p><h1>โปรไฟล์ผู้ดูแลระบบ</h1><p>จัดการข้อมูลส่วนตัวและรูปโปรไฟล์ของบัญชีผู้ดูแลระบบ</p></div><span className="admin-profile-status"><span />บัญชีผู้ดูแลระบบ</span></header>
    <div className="admin-profile-grid">
      <section className="admin-profile-card admin-profile-identity">
        <div className="admin-profile-avatar-wrap">{profile.avatar_url ? <img className="admin-profile-avatar" src={profile.avatar_url} alt="รูปโปรไฟล์ผู้ดูแลระบบ" /> : <div className="admin-profile-avatar admin-profile-avatar--fallback">{initials(name)}</div>}</div>
        <h2>{name || "ผู้ดูแลระบบ"}</h2><span className="admin-profile-role">ADMIN</span>
        <div className="admin-profile-avatar-actions"><button type="button" className="admin-profile-button" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? "กำลังดำเนินการ..." : "เปลี่ยนรูปโปรไฟล์"}</button>{profile.avatar_url && <button type="button" className="admin-profile-button admin-profile-button--light" onClick={() => void removeAvatar()} disabled={uploading}>ลบรูป</button>}</div>
        <p className="admin-profile-hint">JPG, PNG หรือ WebP • ขนาดไม่เกิน 2 MB</p>
        <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void uploadAvatar(file); event.currentTarget.value = ""; }} />
        <div className="admin-profile-meta"><span>อีเมลบัญชี</span><strong>{profile.email || "ไม่พบอีเมล"}</strong><span>สิทธิ์การใช้งาน</span><strong>ผู้ดูแลระบบ (Admin)</strong></div>
      </section>
      <form className="admin-profile-card admin-profile-form" onSubmit={saveProfile}>
        <div className="admin-profile-section-heading"><span className="admin-profile-section-icon">01</span><div><h2>ข้อมูลส่วนตัว</h2><p>แก้ไขชื่อและเบอร์โทรศัพท์ที่แสดงในระบบ</p></div></div>
        <label>ชื่อ-นามสกุล<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="กรอกชื่อ-นามสกุล" required /></label>
        <label>เบอร์โทรศัพท์<input autoComplete="tel" inputMode="numeric" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="08xxxxxxxx" /></label>
        <label>อีเมล<input type="email" value={profile.email ?? ""} disabled readOnly /><small>อีเมลนี้ใช้เข้าสู่ระบบ แก้ไขจากหน้านี้ไม่ได้</small></label>
        {error && <div role="alert" className="admin-profile-alert admin-profile-alert--error">{error}</div>}{success && <div role="status" className="admin-profile-alert admin-profile-alert--success">{success}</div>}
        <div className="admin-profile-form-footer"><span>ข้อมูลจะถูกบันทึกในฐานข้อมูล Supabase</span><button type="submit" className="admin-profile-button" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}</button></div>
      </form>
    </div>
  </main>;
}
