"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentProfile, upsertCurrentProfile } from "@/features/auth";
import { createClient } from "@/lib/supabase/browser";

type AuthMode = "login" | "register";

type AuthMessage = {
  tone: "success" | "error" | "info";
  text: string;
};

// ข้อความ error จาก Supabase เป็นภาษาอังกฤษ แปลกรณีที่เจอบ่อยให้ลูกค้าอ่านเข้าใจ
const AUTH_ERROR_TEXT: [RegExp, string][] = [
  [/invalid login credentials/i, "อีเมลหรือรหัสผ่านไม่ถูกต้อง"],
  [/email not confirmed/i, "อีเมลนี้ยังไม่ได้ยืนยัน กรุณากดลิงก์ยืนยันในอีเมลของคุณก่อน"],
  [/already registered|already been registered/i, "อีเมลนี้สมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบแทน"],
  [/rate limit|only request this after|too many requests/i, "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่"],
  [/password should be at least/i, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"],
  [/invalid format|valid email/i, "รูปแบบอีเมลไม่ถูกต้อง"],
  [/failed to fetch|network/i, "เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"],
];

function toThaiAuthError(message: string) {
  return AUTH_ERROR_TEXT.find(([pattern]) => pattern.test(message))?.[1] ?? message;
}

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const UserIcon = () => <Svg><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></Svg>;
const MailIcon = () => <Svg><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg>;
const LockIcon = () => <Svg><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>;
const PhoneIcon = () => <Svg><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></Svg>;
const CheckIcon = () => <Svg><path d="m5 12 4.5 4.5L19 7" /></Svg>;

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <Svg><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></Svg>
  ) : (
    <Svg><path d="m3 3 18 18M10.6 6.2A10.5 10.5 0 0 1 12 6c6 0 9.5 6 9.5 6a18.5 18.5 0 0 1-3.2 3.7M6.7 6.8C3.8 8.6 2.5 12 2.5 12s3.5 6 9.5 6c1.1 0 2.1-.2 3-.5" /></Svg>
  );
}

function Field({
  label,
  hint,
  icon,
  action,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; icon: React.ReactNode; action?: React.ReactNode }) {
  return (
    <label className="auth-field">
      <span className="auth-field__label">{label}</span>
      <span className="auth-input">
        <span className="auth-input__icon">{icon}</span>
        <input {...props} />
        {action}
      </span>
      {hint ? <span className="auth-field__hint">{hint}</span> : null}
    </label>
  );
}

const BENEFITS = [
  "จองคิวซ่อมรถออนไลน์ เลือกวันเวลาที่สะดวกได้เอง",
  "ติดตามสถานะงานซ่อมได้ทุกขั้นตอน",
  "เก็บข้อมูลรถ ประวัติการจอง และคำสั่งซื้อไว้ในที่เดียว",
];

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

    void checkExistingSession();
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
        setMessage({ text: toThaiAuthError(error.message), tone: "error" });
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
      setMessage({ text: toThaiAuthError(error.message), tone: "error" });
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
      setMessage({ text: toThaiAuthError(error.message), tone: "error" });
      return;
    }

    setMessage({
      text: "ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว",
      tone: "success",
    });
  }

  if (checkingSession) {
    return (
      <div className="auth-checking">
        <span className="auth-checking__spinner" aria-hidden="true" />
        <p>กำลังตรวจสอบสถานะ...</p>
      </div>
    );
  }

  const isLogin = mode === "login";

  return (
    <main className="auth-page">
      <section className="auth-showcase" aria-hidden="true">
        <div className="auth-showcase__content">
          <p className="auth-showcase__eyebrow">ศูนย์บริการรถยนต์</p>
          <h2>ดูแลรถของคุณ<br />เหมือนรถของเรา</h2>
          <ul>
            {BENEFITS.map((benefit) => (
              <li key={benefit}><span><CheckIcon /></span>{benefit}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card__top">
            <Link href="/" className="auth-logo" aria-label="อู่ช่างโอ หน้าหลัก">
              <Image src="/brand/ouchang-o-logo.png" alt="อู่ช่างโอ" width={800} height={374} priority />
            </Link>
            <Link href="/" className="auth-back">← กลับหน้าหลัก</Link>
          </div>

          <div className="auth-heading">
            <h1>{isLogin ? "ยินดีต้อนรับกลับมา" : "สร้างบัญชีใหม่"}</h1>
            <p>
              {isLogin
                ? "เข้าสู่ระบบเพื่อจองคิว ดูข้อมูลรถ และติดตามงานซ่อมของคุณ"
                : "สมัครฟรี ใช้เวลาไม่ถึงนาที แล้วจองคิวซ่อมรถได้ทันที"}
            </p>
          </div>

          <div className="auth-mode-switch" role="tablist" aria-label="เลือกการใช้งาน">
            <button type="button" role="tab" aria-selected={isLogin} className={isLogin ? "is-active" : ""} onClick={() => switchMode("login")}>เข้าสู่ระบบ</button>
            <button type="button" role="tab" aria-selected={!isLogin} className={!isLogin ? "is-active" : ""} onClick={() => switchMode("register")}>สมัครสมาชิก</button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {!isLogin ? (
              <div className="auth-grid-2">
                <Field label="ชื่อ-นามสกุล" icon={<UserIcon />} autoComplete="name" onChange={(e) => setFullName(e.target.value)} placeholder="เช่น สมชาย ใจดี" value={fullName} />
                <Field label="เบอร์โทรศัพท์" icon={<PhoneIcon />} type="tel" inputMode="tel" autoComplete="tel" onChange={(e) => setPhoneNumber(e.target.value)} placeholder="08x-xxx-xxxx" value={phoneNumber} />
              </div>
            ) : null}

            <Field label="อีเมล" icon={<MailIcon />} type="email" inputMode="email" autoComplete="email" onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" value={email} />

            <Field
              label="รหัสผ่าน"
              hint={isLogin ? undefined : "อย่างน้อย 6 ตัวอักษร"}
              icon={<LockIcon />}
              type={showPassword ? "text" : "password"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isLogin ? "กรอกรหัสผ่าน" : "ตั้งรหัสผ่าน"}
              value={password}
              action={
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
                  <EyeIcon open={!showPassword} />
                </button>
              }
            />

            {isLogin ? (
              <div className="auth-options">
                <button type="button" onClick={handleForgotPassword}>ลืมรหัสผ่าน?</button>
              </div>
            ) : null}

            {message ? (
              <div className={`auth-message ${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</div>
            ) : null}

            <button className="auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "กำลังดำเนินการ..." : isLogin ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
            </button>

            {!isLogin ? <p className="auth-hint">การสมัครสมาชิกถือว่ายอมรับเงื่อนไขการใช้งานของอู่ช่างโอ</p> : null}
          </form>

          <p className="auth-switch">
            {isLogin ? "ยังไม่มีบัญชี?" : "มีบัญชีอยู่แล้ว?"}{" "}
            <button type="button" onClick={() => switchMode(isLogin ? "register" : "login")}>
              {isLogin ? "สมัครสมาชิกฟรี" : "เข้าสู่ระบบ"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
