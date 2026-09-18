"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AppNav } from "@/components/app-nav";
import {
  getCurrentProfile,
  upsertCurrentProfile,
  type Profile,
} from "@/features/auth";
import { createClient } from "@/lib/supabase/browser";

type AuthMode = "login" | "register";

type AuthMessage = {
  tone: "success" | "error" | "info";
  text: string;
};

const emptyMessage: AuthMessage | null = null;

export function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(emptyMessage);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFullName, setProfileFullName] = useState("");
  const [profilePhoneNumber, setProfilePhoneNumber] = useState("");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile(nextUser: User | null) {
      if (!nextUser) {
        setProfile(null);
        setProfileFullName("");
        setProfilePhoneNumber("");
        return;
      }

      const { data } = await getCurrentProfile(supabase, nextUser.id);
      setProfile(data ?? null);
      setProfileFullName(data?.full_name ?? "");
      setProfilePhoneNumber(data?.phone_number ?? "");
    }

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      loadProfile(session?.user ?? null);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      loadProfile(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  function resetForm(nextMode: AuthMode) {
    setMode(nextMode);
    setEmail("");
    setPassword("");
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
      setMessage({
        text: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
        tone: "error",
      });
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      setIsSubmitting(false);

      if (error) {
        setMessage({ text: error.message, tone: "error" });
        return;
      }

      setUser(data.user ?? null);
      setMessage({
        text: data.session
          ? "สมัครสมาชิกและเข้าสู่ระบบสำเร็จ"
          : "สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลหากเปิดใช้การยืนยันตัวตน",
        tone: "success",
      });
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setMessage({ text: error.message, tone: "error" });
      return;
    }

    setUser(data.user ?? null);
    setMessage({ text: "เข้าสู่ระบบสำเร็จ", tone: "success" });
  }

  async function handleSignOut() {
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      setMessage({ text: error.message, tone: "error" });
      return;
    }

    setUser(null);
    setProfile(null);
    setProfileFullName("");
    setProfilePhoneNumber("");
    setMessage({ text: "ออกจากระบบเรียบร้อยแล้ว", tone: "success" });
  }

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setMessage({ text: "กรุณาเข้าสู่ระบบก่อนบันทึกโปรไฟล์", tone: "error" });
      return;
    }

    if (!profileFullName.trim()) {
      setMessage({ text: "กรุณากรอกชื่อ-นามสกุล", tone: "error" });
      return;
    }

    if (!profilePhoneNumber.trim()) {
      setMessage({ text: "กรุณากรอกเบอร์โทรศัพท์", tone: "error" });
      return;
    }

    setIsSavingProfile(true);
    setMessage(null);

    const supabase = createClient();
    const { data, error } = await upsertCurrentProfile(supabase, {
      email: user.email ?? null,
      fullName: profileFullName.trim(),
      phoneNumber: profilePhoneNumber.trim(),
      userId: user.id,
    });

    setIsSavingProfile(false);

    if (error) {
      setMessage({ text: error.message, tone: "error" });
      return;
    }

    setProfile(data);
    setProfileFullName(data.full_name);
    setProfilePhoneNumber(data.phone_number);
    setMessage({ text: "บันทึกโปรไฟล์สำเร็จ", tone: "success" });
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <AppNav />

      <header className="border-b border-[var(--line)] pb-5 pt-2">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          บัญชีและโปรไฟล์
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
          เข้าสู่ระบบ สมัครสมาชิก และตั้งค่าโปรไฟล์ลูกค้าให้พร้อมสำหรับการจองคิว
        </p>
      </header>

      <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          className="h-fit rounded-xl border border-[var(--line)] bg-white p-6 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--concrete-2)] p-1">
            <button
              className={
                mode === "login"
                  ? "min-h-10 rounded-md bg-[var(--brand)] px-3 text-sm font-semibold text-white shadow-sm"
                  : "min-h-10 rounded-md px-3 text-sm font-semibold text-[var(--muted)]"
              }
              onClick={() => resetForm("login")}
              type="button"
            >
              เข้าสู่ระบบ
            </button>
            <button
              className={
                mode === "register"
                  ? "min-h-10 rounded-md bg-[var(--brand)] px-3 text-sm font-semibold text-white shadow-sm"
                  : "min-h-10 rounded-md px-3 text-sm font-semibold text-[var(--muted)]"
              }
              onClick={() => resetForm("register")}
              type="button"
            >
              สมัครสมาชิก
            </button>
          </div>

          <div className="mt-6">
            <label
              className="text-sm font-medium text-[var(--foreground)]"
              htmlFor="email"
            >
              อีเมล
            </label>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              id="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </div>

          <div className="mt-4">
            <label
              className="text-sm font-medium text-[var(--foreground)]"
              htmlFor="password"
            >
              รหัสผ่าน
            </label>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              type="password"
              value={password}
            />
          </div>

          <button
            className="mt-6 min-h-11 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? "กำลังดำเนินการ..."
              : mode === "register"
                ? "สมัครสมาชิก"
                : "เข้าสู่ระบบ"}
          </button>

          {message ? (
            <div
              className={
                message.tone === "error"
                  ? "mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                  : "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-[var(--brand-strong)]"
              }
            >
              {message.text}
            </div>
          ) : null}
        </form>

        <div className="space-y-6">
          <aside className="h-fit rounded-xl border border-[var(--line)] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--brand)]">
              สถานะการเข้าสู่ระบบ
            </p>
            {user ? (
              <div className="mt-4">
                <p className="break-all text-sm font-semibold text-[var(--foreground)]">
                  {user.email}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  รหัสผู้ใช้: {user.id}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  สิทธิ์การใช้งาน: {profile?.role ?? "customer"}
                </p>
                <button
                  className="mt-5 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                  onClick={handleSignOut}
                  type="button"
                >
                  ออกจากระบบ
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                ยังไม่มีการเข้าสู่ระบบในเบราว์เซอร์นี้
              </p>
            )}
          </aside>

          <form
            className="h-fit rounded-xl border border-[var(--line)] bg-white p-5 shadow-sm"
            onSubmit={handleProfileSubmit}
          >
            <p className="text-sm font-semibold text-[var(--brand)]">
              โปรไฟล์ลูกค้า
            </p>
            {user ? (
              <div className="mt-4 space-y-4">
                <div>
                  <label
                    className="text-sm font-medium text-[var(--foreground)]"
                    htmlFor="profileFullName"
                  >
                    ชื่อ-นามสกุล
                  </label>
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                    id="profileFullName"
                    onChange={(event) =>
                      setProfileFullName(event.target.value)
                    }
                    value={profileFullName}
                  />
                </div>
                <div>
                  <label
                    className="text-sm font-medium text-[var(--foreground)]"
                    htmlFor="profilePhoneNumber"
                  >
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                    id="profilePhoneNumber"
                    inputMode="tel"
                    onChange={(event) =>
                      setProfilePhoneNumber(event.target.value)
                    }
                    value={profilePhoneNumber}
                  />
                </div>
                <button
                  className="min-h-10 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSavingProfile}
                  type="submit"
                >
                  {isSavingProfile ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
                </button>
                {profile ? (
                  <p className="text-xs leading-5 text-[var(--muted)]">
                    โปรไฟล์นี้ผูกกับบัญชีของคุณเรียบร้อยแล้ว
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                กรุณาเข้าสู่ระบบหรือสมัครสมาชิกก่อนสร้างโปรไฟล์ลูกค้า
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
