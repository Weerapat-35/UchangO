"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getTechnicianWorkOrders, type TechnicianWorkOrder, type TechnicianWorkOrdersResult } from "@/features/technician";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; result: null; error: null }
  | { status: "signed-out"; result: null; error: null }
  | { status: "ready"; result: TechnicianWorkOrdersResult; error: null }
  | { status: "error"; result: null; error: string };

function statusLabel(status: TechnicianWorkOrder["status"]) {
  return {
    pending: "รอมอบหมาย",
    assigned: "ได้รับมอบหมาย",
    in_progress: "กำลังซ่อม",
    completed: "เสร็จแล้ว",
    cancelled: "ยกเลิก",
  }[status] ?? status;
}

function statusClass(status: TechnicianWorkOrder["status"]) {
  return {
    pending: "is-pending",
    assigned: "is-assigned",
    in_progress: "is-progress",
    completed: "is-completed",
    cancelled: "is-cancelled",
  }[status] ?? "is-assigned";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string | null | undefined) {
  if (!value) return "-";
  return value.slice(0, 5);
}

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function TechnicianDashboardPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", result: null, error: null });

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function load() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;
      if (sessionError) {
        setLoadState({ status: "error", result: null, error: sessionError.message });
        return;
      }
      if (!session?.user) {
        setLoadState({ status: "signed-out", result: null, error: null });
        return;
      }

      const { data, error } = await getTechnicianWorkOrders(supabase, session.user.id);
      if (!mounted) return;
      if (error) {
        setLoadState({ status: "error", result: null, error: error.message });
        return;
      }
      setLoadState({ status: "ready", result: data, error: null });
    }

    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => void load());

    const channel = supabase
      .channel("technician-dashboard-repair-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "repair_jobs" },
        () => void load(),
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const jobs = loadState.status === "ready" && loadState.result?.allowed ? loadState.result.workOrders : [];
    const today = todayKey();
    const todayJobs = jobs.filter((job) => job.booking?.booking_date === today);
    return {
      total: jobs.length,
      today: todayJobs.length,
      active: jobs.filter((job) => job.status === "in_progress").length,
      assigned: jobs.filter((job) => job.status === "assigned" || job.status === "pending").length,
      completed: jobs.filter((job) => job.status === "completed").length,
      recent: jobs.slice(0, 5),
    };
  }, [loadState]);

  if (loadState.status === "loading") {
    return <main className="technician-dashboard"><div className="technician-dashboard__loading">กำลังโหลดข้อมูล...</div></main>;
  }

  if (loadState.status === "signed-out") {
    return <main className="technician-dashboard"><div className="technician-dashboard__message"><strong>กรุณาเข้าสู่ระบบ</strong><span>เข้าสู่ระบบด้วยบัญชีช่างเพื่อดู Dashboard</span><Link href="/auth">เข้าสู่ระบบ</Link></div></main>;
  }

  if (loadState.status === "error") {
    return <main className="technician-dashboard"><div className="technician-dashboard__message is-error"><strong>ไม่สามารถโหลดข้อมูลได้</strong><span>{loadState.error}</span></div></main>;
  }

  if (!loadState.result?.allowed) {
    return <main className="technician-dashboard"><div className="technician-dashboard__message is-error"><strong>ไม่มีสิทธิ์เข้าใช้งาน</strong><span>{loadState.result?.reason}</span></div></main>;
  }

  const name = loadState.result.profile.full_name?.trim() || "ช่าง";

  return (
    <main className="technician-dashboard">
      <section className="technician-dashboard__welcome">
        <div>
          <p className="technician-dashboard__eyebrow">ภาพรวมการทำงาน</p>
          <h1>สวัสดีครับ {name}</h1>
          <p>นี่คือภาพรวมงานซ่อมที่ได้รับมอบหมายและงานที่กำลังดำเนินการ</p>
        </div>
        <Link href="/technician/work-orders" className="technician-dashboard__primary">ดูงานซ่อมทั้งหมด</Link>
      </section>

      <section className="technician-dashboard__stats" aria-label="สรุปงานซ่อม">
        <div className="technician-stat-card"><span>งานทั้งหมด</span><strong>{stats.total}</strong><small>งานที่ได้รับมอบหมาย</small></div>
        <div className="technician-stat-card"><span>งานวันนี้</span><strong>{stats.today}</strong><small>ตามวันนัดหมาย</small></div>
        <div className="technician-stat-card technician-stat-card--accent"><span>กำลังซ่อม</span><strong>{stats.active}</strong><small>งานที่กำลังดำเนินการ</small></div>
        <div className="technician-stat-card"><span>รอดำเนินการ</span><strong>{stats.assigned}</strong><small>รอเริ่มงาน</small></div>
        <div className="technician-stat-card"><span>เสร็จแล้ว</span><strong>{stats.completed}</strong><small>งานที่ปิดเรียบร้อย</small></div>
      </section>

      <section className="technician-dashboard__grid">
        <div className="technician-dashboard__panel">
          <div className="technician-dashboard__panel-head">
            <div><h2>งานล่าสุด</h2><p>รายการงานซ่อมที่มีการอัปเดตล่าสุด</p></div>
            <Link href="/technician/work-orders">ดูทั้งหมด</Link>
          </div>
          {stats.recent.length === 0 ? (
            <div className="technician-dashboard__empty">ยังไม่มีงานซ่อมที่ได้รับมอบหมาย</div>
          ) : (
            <div className="technician-dashboard__jobs">
              {stats.recent.map((job) => (
                <Link key={job.id} href={`/technician/work-orders/${job.id}`} className="technician-dashboard__job">
                  <div className="technician-dashboard__job-main">
                    <strong>{job.service?.name || "งานซ่อมรถยนต์"}</strong>
                    <span>{job.vehicle?.license_plate || "ไม่ระบุทะเบียน"} · {job.customer?.full_name || "ไม่ระบุลูกค้า"}</span>
                  </div>
                  <div className="technician-dashboard__job-meta">
                    <span className={`technician-job-status ${statusClass(job.status)}`}>{statusLabel(job.status)}</span>
                    <small>{formatDate(job.booking?.booking_date)} {formatTime(job.booking?.booking_time)}</small>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="technician-dashboard__panel technician-dashboard__quick">
          <div className="technician-dashboard__panel-head"><div><h2>ทางลัด</h2><p>เมนูที่ใช้บ่อย</p></div></div>
          <Link href="/technician/work-orders" className="technician-quick-link"><span>🔧</span><div><strong>งานซ่อมของฉัน</strong><small>ดูและอัปเดตสถานะงาน</small></div><b>›</b></Link>
          <Link href="/technician/profile" className="technician-quick-link"><span>👤</span><div><strong>โปรไฟล์ช่าง</strong><small>แก้ไขข้อมูลและทักษะ</small></div><b>›</b></Link>
        </div>
      </section>
    </main>
  );
}
