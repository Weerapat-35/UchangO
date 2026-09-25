"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { ProfileWithAvatar } from "@/features/profile-types";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join("") || "U").toUpperCase();
}

export function ProfilePage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<ProfileWithAvatar | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadProfile() {
    const supabase = createClient();
    setLoading(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data, error: profileError } = await (supabase as any)
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) setError(profileError.message);
    if (data) {
      setProfile(data as ProfileWithAvatar);
      setName(data.full_name ?? "");
      setPhone(data.phone_number ?? "");
    }
    setLoading(false);
  }

  useEffect(() => { void loadProfile(); }, []);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    if (!name.trim()) { setError("กรุณากรอกชื่อ"); return; }
    if (!/^0\d{9}$/.test(phone.trim())) { setError("เบอร์โทรต้องมี 10 หลักและขึ้นต้นด้วย 0"); return; }
    setSaving(true); setError(""); setMessage("");
    const supabase = createClient();
    const { data, error: saveError } = await (supabase as any)
      .from("profiles")
      .update({ full_name: name.trim(), phone_number: phone.trim() })
      .eq("id", profile.id)
      .select("*")
      .single();
    if (saveError) setError(saveError.message);
    else { setProfile(data as ProfileWithAvatar); setMessage("บันทึกข้อมูลโปรไฟล์แล้ว"); }
    setSaving(false);
  }

  async function uploadAvatar(file: File) {
    if (!profile) return;
    setError(""); setMessage("");
    if (!ACCEPTED_TYPES.includes(file.type)) { setError("รองรับเฉพาะ JPG, PNG และ WebP"); return; }
    if (file.size > MAX_FILE_SIZE) { setError("รูปภาพต้องมีขนาดไม่เกิน 2 MB"); return; }
    setUploading(true);
    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${profile.id}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) { setError(uploadError.message); setUploading(false); return; }
    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = publicData.publicUrl;
    const { data, error: updateError } = await (supabase as any)
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", profile.id)
      .select("*")
      .single();
    if (updateError) setError(updateError.message);
    else { setProfile(data as ProfileWithAvatar); setMessage("เปลี่ยนรูปโปรไฟล์แล้ว"); }
    setUploading(false);
  }

  async function removeAvatar() {
    if (!profile?.avatar_url) return;
    setUploading(true); setError(""); setMessage("");
    const supabase = createClient();
    const marker = "/storage/v1/object/public/avatars/";
    const index = profile.avatar_url.indexOf(marker);
    if (index >= 0) {
      const oldPath = decodeURIComponent(profile.avatar_url.slice(index + marker.length));
      await supabase.storage.from("avatars").remove([oldPath]);
    }
    const { data, error: updateError } = await (supabase as any)
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", profile.id)
      .select("*")
      .single();
    if (updateError) setError(updateError.message);
    else { setProfile(data as ProfileWithAvatar); setMessage("ลบรูปโปรไฟล์แล้ว"); }
    setUploading(false);
  }

  if (loading) return <main className="profile-page"><div className="profile-card profile-loading">กำลังโหลดโปรไฟล์...</div></main>;
  if (!profile) return <main className="profile-page"><div className="profile-card"><h1>โปรไฟล์</h1><p>กรุณาเข้าสู่ระบบก่อน</p><Link href="/auth" className="profile-primary-button">เข้าสู่ระบบ</Link></div></main>;

  return (
    <main className="profile-page">
      <div className="profile-page__heading">
        <div><p className="profile-kicker">ACCOUNT</p><h1>โปรไฟล์ของฉัน</h1><p>จัดการข้อมูลส่วนตัวและรูปโปรไฟล์ของคุณ</p></div>
      </div>
      <div className="profile-grid">
        <section className="profile-card profile-avatar-card">
          <div className="profile-avatar-wrap">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="รูปโปรไฟล์" className="profile-avatar" /> : <div className="profile-avatar profile-avatar--fallback">{initials(name)}</div>}
          </div>
          <h2>{name || "ผู้ใช้งาน"}</h2>
          <span className="profile-role">ลูกค้า</span>
          <div className="profile-avatar-actions">
            <button type="button" className="profile-primary-button" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? "กำลังอัปโหลด..." : "เปลี่ยนรูปโปรไฟล์"}</button>
            {profile.avatar_url ? <button type="button" className="profile-secondary-button" onClick={() => void removeAvatar()} disabled={uploading}>ลบรูป</button> : null}
          </div>
          <p className="profile-help">JPG, PNG หรือ WebP • ไม่เกิน 2 MB</p>
          <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadAvatar(file); e.currentTarget.value = ""; }} />
        </section>

        <form className="profile-card profile-form" onSubmit={saveProfile}>
          <div className="profile-card__title"><div><p className="profile-kicker">PERSONAL INFORMATION</p><h2>ข้อมูลส่วนตัว</h2></div></div>
          <label>ชื่อ-นามสกุล<input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" /></label>
          <label>เบอร์โทรศัพท์<input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="08xxxxxxxx" /></label>
          <label>อีเมล<input value={profile.email ?? ""} disabled /></label>
          {error ? <div className="profile-alert profile-alert--error">{error}</div> : null}
          {message ? <div className="profile-alert profile-alert--success">{message}</div> : null}
          <button className="profile-primary-button profile-save" type="submit" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</button>
        </form>
      </div>
    </main>
  );
}
