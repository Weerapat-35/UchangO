"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { randomId } from "@/lib/random-id";
import type { ProfileWithAvatar } from "@/features/profile-types";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join("") || "U").toUpperCase();
}

function isAdminRole(role: string | null | undefined) {
  return role?.trim().toLowerCase() === "admin";
}

function readableError(message: string) {
  if (/row-level security|permission denied|not allowed/i.test(message)) {
    return "ไม่มีสิทธิ์บันทึกข้อมูล กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง";
  }
  if (/bucket not found/i.test(message)) {
    return "ยังไม่มี Storage bucket ชื่อ avatars ใน Supabase กรุณาสร้าง bucket ก่อนอัปโหลดรูป";
  }
  return message;
}

export function ProfilePage({ adminMode = false }: { adminMode?: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<ProfileWithAvatar | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError("");
      setSignedOut(false);
      setAccessDenied(false);
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      // ยังไม่ได้ล็อกอิน Supabase จะตอบเป็น error "Auth session missing" ให้ถือว่าออกจากระบบอยู่
      if (authError && !/session missing/i.test(authError.message)) {
        setError(readableError(authError.message));
        setLoading(false);
        return;
      }
      if (!user) {
        setProfile(null);
        setSignedOut(true);
        setLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, phone_number, email, role, avatar_url, technician_specialty")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(readableError(profileError.message));
        setProfile(null);
        setLoading(false);
        return;
      }
      if (!data) {
        setProfile(null);
        setError("ไม่พบข้อมูลโปรไฟล์ของบัญชีนี้ กรุณาติดต่ออู่");
        setLoading(false);
        return;
      }
      if (adminMode && !isAdminRole(data.role)) {
        setProfile(null);
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const nextProfile = { ...data, email: data.email ?? user.email ?? null } as ProfileWithAvatar;
      setProfile(nextProfile);
      setName(nextProfile.full_name ?? "");
      setPhone(nextProfile.phone_number ?? "");
      setLoading(false);
    }

    void loadProfile();
  }, [adminMode, reloadKey]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    if (!name.trim()) { setError("กรุณากรอกชื่อ-นามสกุล"); setMessage(""); return; }
    if (!/^0\d{9}$/.test(phone.trim())) { setError("เบอร์โทรศัพท์ต้องมี 10 หลักและขึ้นต้นด้วย 0"); setMessage(""); return; }

    setSaving(true);
    setError("");
    setMessage("");
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== profile.id) {
      setError("เซสชันหมดอายุหรือบัญชีผู้ใช้เปลี่ยนไป กรุณาเข้าสู่ระบบใหม่");
      setSaving(false);
      return;
    }
    const { data, error: saveError } = await supabase
      .from("profiles")
      .update({ full_name: name.trim(), phone_number: phone.trim() })
      .eq("id", user.id)
      .select("id, full_name, phone_number, email, role, avatar_url, technician_specialty")
      .single();
    if (saveError) {
      setError(readableError(saveError.message));
    } else if (!data) {
      setError("บันทึกไม่สำเร็จ ไม่พบข้อมูลโปรไฟล์ที่ตรงกับบัญชีนี้");
    } else {
      const updated = { ...data, email: data.email ?? user.email ?? null } as ProfileWithAvatar;
      setProfile(updated);
      setName(updated.full_name ?? "");
      setPhone(updated.phone_number ?? "");
      setMessage("บันทึกข้อมูลโปรไฟล์ลง Supabase เรียบร้อยแล้ว");
    }
    setSaving(false);
  }

  async function uploadAvatar(file: File) {
    if (!profile) return;
    setError(""); setMessage("");
    if (!ACCEPTED_TYPES.includes(file.type)) { setError("รองรับเฉพาะไฟล์ JPG, PNG และ WebP"); return; }
    if (file.size > MAX_FILE_SIZE) { setError("รูปภาพต้องมีขนาดไม่เกิน 2 MB"); return; }
    setUploading(true);
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== profile.id) {
      setError("เซสชันหมดอายุหรือบัญชีผู้ใช้เปลี่ยนไป กรุณาเข้าสู่ระบบใหม่");
      setUploading(false);
      return;
    }
    const extensionByType: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    };
    const path = `${user.id}/${Date.now()}-${randomId(6)}.${extensionByType[file.type]}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      cacheControl: "3600", contentType: file.type, upsert: false,
    });
    if (uploadError) {
      setError(readableError(uploadError.message));
      setUploading(false);
      return;
    }

    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = publicData.publicUrl;
    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id)
      .select("id, full_name, phone_number, email, role, avatar_url, technician_specialty")
      .single();
    if (updateError || !data) {
      await supabase.storage.from("avatars").remove([path]);
      setError(updateError ? readableError(updateError.message) : "อัปโหลดรูปแล้ว แต่บันทึก URL ลงโปรไฟล์ไม่สำเร็จ");
    } else {
      setProfile({ ...data, email: data.email ?? user.email ?? null } as ProfileWithAvatar);
      setMessage("อัปโหลดรูปและบันทึก URL ลง Supabase เรียบร้อยแล้ว");
    }
    setUploading(false);
  }

  async function removeAvatar() {
    if (!profile?.avatar_url) return;
    setUploading(true); setError(""); setMessage("");
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== profile.id) {
      setError("เซสชันหมดอายุหรือบัญชีผู้ใช้เปลี่ยนไป กรุณาเข้าสู่ระบบใหม่");
      setUploading(false);
      return;
    }
    const marker = "/storage/v1/object/public/avatars/";
    const index = profile.avatar_url.indexOf(marker);
    if (index >= 0) {
      const oldPath = decodeURIComponent(profile.avatar_url.slice(index + marker.length));
      const { error: removeError } = await supabase.storage.from("avatars").remove([oldPath]);
      if (removeError) {
        setError(readableError(removeError.message));
        setUploading(false);
        return;
      }
    }
    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id)
      .select("id, full_name, phone_number, email, role, avatar_url, technician_specialty")
      .single();
    if (updateError || !data) {
      setError(updateError ? readableError(updateError.message) : "ลบรูปไม่สำเร็จ กรุณาลองอีกครั้ง");
    } else {
      setProfile({ ...data, email: data.email ?? user.email ?? null } as ProfileWithAvatar);
      setMessage("ลบรูปโปรไฟล์และอัปเดต Supabase เรียบร้อยแล้ว");
    }
    setUploading(false);
  }

  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = "/";
  }

  if (loading) return <main className="profile-page"><div className="profile-card profile-loading">กำลังโหลดโปรไฟล์...</div></main>;
  if (accessDenied) return <main className="profile-page"><div className="profile-card"><h1>ไม่มีสิทธิ์เข้าถึง</h1><p>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p><Link href="/" className="profile-primary-button">กลับหน้าหลัก</Link></div></main>;
  if (signedOut) return <main className="profile-page"><div className="profile-card"><h1>โปรไฟล์</h1><p>กรุณาเข้าสู่ระบบก่อน</p><Link href="/auth" className="profile-primary-button">เข้าสู่ระบบ</Link></div></main>;
  if (!profile) return <main className="profile-page"><div className="profile-card"><h1>{adminMode ? "โปรไฟล์ผู้ดูแลระบบ" : "โปรไฟล์"}</h1><p className="profile-alert profile-alert--error">{error || "โหลดข้อมูลโปรไฟล์ไม่สำเร็จ"}</p><button type="button" className="profile-primary-button" onClick={() => setReloadKey((key) => key + 1)}>ลองโหลดอีกครั้ง</button></div></main>;

  return (
    <main className="profile-page">
      <div className="profile-page__heading">
        <div><p className="profile-kicker">{adminMode ? "บัญชีผู้ดูแลระบบ" : "ACCOUNT"}</p><h1>{adminMode ? "โปรไฟล์ผู้ดูแลระบบ" : "โปรไฟล์ของฉัน"}</h1><p>จัดการข้อมูลส่วนตัวและรูปโปรไฟล์ของคุณ</p></div>
      </div>
      <div className="profile-grid">
        <section className="profile-card profile-avatar-card">
          <div className="profile-avatar-wrap">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="รูปโปรไฟล์" className="profile-avatar" /> : <div className="profile-avatar profile-avatar--fallback">{initials(name)}</div>}
          </div>
          <h2>{name || "ผู้ใช้งาน"}</h2>
          <span className="profile-role">{adminMode ? "ผู้ดูแลระบบ" : (isAdminRole(profile.role) ? "ผู้ดูแลระบบ" : profile.role === "technician" || profile.role === "ช่าง" ? "ช่าง" : "ลูกค้า")}</span>
          <div className="profile-avatar-actions">
            <button type="button" className="profile-primary-button" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? "กำลังอัปโหลด..." : "เปลี่ยนรูปโปรไฟล์"}</button>
            {profile.avatar_url ? <button type="button" className="profile-secondary-button" onClick={() => void removeAvatar()} disabled={uploading}>ลบรูป</button> : null}
          </div>
          <p className="profile-help">JPG, PNG หรือ WebP • ไม่เกิน 2 MB</p>
          <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadAvatar(file); e.currentTarget.value = ""; }} />
        </section>

        <form className="profile-card profile-form" onSubmit={saveProfile}>
          <div className="profile-card__title"><div><p className="profile-kicker">ข้อมูลส่วนตัว</p><h2>ข้อมูลส่วนตัว</h2></div></div>
          <label>ชื่อ-นามสกุล<input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" maxLength={120} required /></label>
          <label>เบอร์โทรศัพท์<input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="tel" placeholder="08xxxxxxxx" required /></label>
          <label>อีเมล<input value={profile.email ?? ""} disabled /></label>
          {error ? <div className="profile-alert profile-alert--error" role="alert">{error}</div> : null}
          {message ? <div className="profile-alert profile-alert--success" role="status">{message}</div> : null}
          <button className="profile-primary-button profile-save" type="submit" disabled={saving || uploading}>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</button>
        </form>
        {!adminMode ? (
          <button type="button" className="profile-signout" onClick={() => void signOut()}>ออกจากระบบ</button>
        ) : null}
      </div>
    </main>
  );
}
