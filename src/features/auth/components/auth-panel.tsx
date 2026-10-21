"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentProfile, upsertCurrentProfile } from "@/features/auth";
import { createClient } from "@/lib/supabase/browser";

type AuthMode = "login" | "register";

type AuthMessage = {
  tone: "success" | "error" | "info";
  text: string;
};

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m3 3 18 18M10.6 6.2A10.5 10.5 0 0 1 12 6c6 0 9.5 6 9.5 6a18.5 18.5 0 0 1-3.2 3.7M6.7 6.8C3.8 8.6 2.5 12 2.5 12s3.5 6 9.5 6c1.1 0 2.1-.2 3-.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
    </svg>
  );
}

/** ภาพประกอบวงกลม: โลโก้ + รถยนต์เส้น พร้อมเส้นความเร็ว */
function BrandCar() {
  return (
    <svg width="140" height="60" viewBox="0 0 140 60" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M2 22h24M2 32h20M2 42h16" strokeLinecap="round" />
      <path
        d="M30 44V32l6-14h34l8 14h8a4 4 0 0 1 4 4v8"
        strokeLinejoin="round"
      />
      <path d="M30 44h64" strokeLinecap="round" />
      <circle cx="45" cy="44" r="7" />
      <circle cx="90" cy="44" r="7" />
    </svg>
  );
}

function InputField({
  icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[var(--concrete-2)] px-4 py-3.5">
      <span className="text-[var(--muted)]">{icon}</span>
      <input
        {...props}
        className="min-h-6 w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
      />
    </div>
  );
}

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [checkingSession, setCheckingSession] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);

  // ถ้า login อยู่แล้ว ไม่ต้องเห็นหน้านี้ เด้งไปหน้าของ role ทันที
  useEffect(() => {
    async function checkExistingSession() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setCheckingSession(false);
        return;
      }

      const { data: profile } = await getCurrentProfile(supabase, session.user.id);

      if (profile?.role === "admin") {
        router.replace("/admin");
        return;
      }

      if (profile?.role === "technician") {
        router.replace("/technician/work-orders");
        return;
      }

      router.replace("/");
    }

    checkExistingSession();
  }, [router]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!email.trim()) {
      setMessage({ text: "กรุณากรอกอีเมล", tone: "error" });
      return;
    }

    if (password.length < 6) {
      setMessage({ text: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร", tone: "error" });
      return;
    }

    if (mode === "register" && !fullName.trim()) {
      setMessage({ text: "กรุณากรอกชื่อ-นามสกุล", tone: "error" });
      return;
    }

    if (mode === "register" && !phoneNumber.trim()) {
      setMessage({ text: "กรุณากรอกเบอร์โทรศัพท์", tone: "error" });
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setIsSubmitting(false);
        setMessage({ text: error.message, tone: "error" });
        return;
      }

      if (!data.session || !data.user) {
        setIsSubmitting(false);
        setMessage({
          text: "สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันตัวตนก่อนเข้าสู่ระบบ",
          tone: "success",
        });
        return;
      }

      // สมัครสำเร็จและมี session ทันที -> สร้างโปรไฟล์ในขั้นตอนเดียวกันเลย
      const { error: profileError } = await upsertCurrentProfile(supabase, {
        email: data.user.email ?? null,
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        userId: data.user.id,
      });

      setIsSubmitting(false);

      if (profileError) {
        setMessage({ text: profileError.message, tone: "error" });
        return;
      }

      router.push("/");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setIsSubmitting(false);
      setMessage({ text: error.message, tone: "error" });
      return;
    }

    const { data: profile } = await getCurrentProfile(supabase, data.user.id);
    setIsSubmitting(false);

    if (profile?.role === "admin") {
      router.push("/admin");
      return;
    }

    if (profile?.role === "technician") {
      router.push("/technician/work-orders");
      return;
    }

    router.push("/");
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setMessage({ text: "กรุณากรอกอีเมลก่อนกดลืมรหัสผ่าน", tone: "error" });
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

    if (error) {
      setMessage({ text: error.message, tone: "error" });
      return;
    }

    setMessage({
      text: "ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว",
      tone: "success",
    });
  }

  if (checkingSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <p className="text-sm text-[var(--muted)]">กำลังตรวจสอบสถานะ...</p>
      </div>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="auth-brand__mark">อู่</div>
            <div>
              <strong>ช่างโอ</strong>
              <span>GARAGE SERVICE</span>
            </div>
          </div>

          <div className="auth-heading">
            <h1>{mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</h1>
            <p>
              {mode === "login"
                ? "เข้าสู่ระบบเพื่อจัดการข้อมูลรถและการใช้บริการของคุณ"
                : "สร้างบัญชีเพื่อจองคิวและใช้บริการอู่ช่างโอ"}
            </p>
          </div>

          <div className="auth-mode-switch" role="tablist" aria-label="ประเภทการใช้งาน">
            <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => switchMode("login")}>เข้าสู่ระบบ</button>
            <button type="button" className={mode === "register" ? "is-active" : ""} onClick={() => switchMode("register")}>สมัครสมาชิก</button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <div className="auth-grid-2">
                <InputField icon={<UserIcon />} onChange={(e) => setFullName(e.target.value)} placeholder="ชื่อ-นามสกุล" value={fullName} />
                <InputField icon={<PhoneIcon />} inputMode="tel" onChange={(e) => setPhoneNumber(e.target.value)} placeholder="เบอร์โทรศัพท์" value={phoneNumber} />
              </div>
            ) : null}

            <label className="auth-field">
              <span>อีเมล</span>
              <InputField icon={<UserIcon />} inputMode="email" onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" type="email" value={email} />
            </label>

            <label className="auth-field">
              <span>รหัสผ่าน</span>
              <div className="auth-password-wrap">
                <InputField icon={<LockIcon />} onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่าน" type={showPassword ? "text" : "password"} value={password} />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </label>

            {mode === "login" ? (
              <div className="auth-options">
                <label><input type="checkbox" /> <span>จดจำฉันไว้</span></label>
                <button type="button" onClick={handleForgotPassword}>ลืมรหัสผ่าน?</button>
              </div>
            ) : (
              <p className="auth-hint">การสมัครสมาชิกถือว่ายอมรับเงื่อนไขการใช้งานของอู่ช่างโอ</p>
            )}

            <button className="auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "กำลังดำเนินการ..." : mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
            </button>

            {message ? <div className={`auth-message ${message.tone}`}>{message.text}</div> : null}
          </form>

          <div className="auth-footer-note">ระบบบริการอู่ซ่อมรถ • อู่ช่างโอ</div>
        </div>
      </section>
    </main>
  );
}