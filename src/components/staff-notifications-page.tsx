"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

const icons: Record<string, string> = {
  order: "🛒",
  booking: "📅",
  repair: "🔧",
  payment: "💳",
  system: "🔔",
};

function timeText(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function hrefFor(item: NotificationRow, role: "admin" | "technician") {
  if (item.reference_type === "product_order" && item.reference_id) {
    return role === "admin" ? `/admin/product-orders/${item.reference_id}` : null;
  }
  if (item.reference_type === "booking" && item.reference_id) {
    return role === "admin" ? `/admin/bookings/${item.reference_id}` : null;
  }
  if (item.reference_type === "repair_job" && item.reference_id) {
    return role === "technician" ? `/technician/work-orders/${item.reference_id}` : `/admin/repair-jobs`;
  }
  return null;
}

export function StaffNotificationsPage({ role }: { role: "admin" | "technician" }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const unread = useMemo(() => items.filter((item) => !item.is_read).length, [items]);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async (id: string) => {
      const { data, error: loadError } = await (supabase as any)
        .from("notifications")
        .select("id,type,title,message,reference_id,reference_type,is_read,read_at,created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      if (!mounted) return;
      if (loadError) {
        setError(loadError.message);
        return;
      }
      setItems((data ?? []) as NotificationRow[]);
      setError(null);
    };

    const start = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session?.user) {
        setLoading(false);
        return;
      }
      setUserId(session.user.id);
      await load(session.user.id);
      if (!mounted) return;
      setLoading(false);
      channel = supabase
        .channel(`${role}-notification-center-${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `customer_id=eq.${session.user.id}`,
          },
          () => void load(session.user.id),
        )
        .subscribe();
    };

    void start();
    return () => {
      mounted = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [role]);

  async function markRead(id: string) {
    const supabase = createClient();
    const now = new Date().toISOString();
    const { error: updateError } = await (supabase as any)
      .from("notifications")
      .update({ is_read: true, read_at: now })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: true, read_at: now } : item));
  }

  async function markAll() {
    if (!userId || unread === 0) return;
    setMarking(true);
    const supabase = createClient();
    const now = new Date().toISOString();
    const { error: updateError } = await (supabase as any)
      .from("notifications")
      .update({ is_read: true, read_at: now })
      .eq("customer_id", userId)
      .eq("is_read", false);
    setMarking(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((current) => current.map((item) => ({ ...item, is_read: true, read_at: now })));
  }

  const title = role === "admin" ? "การแจ้งเตือนผู้ดูแลระบบ" : "การแจ้งเตือนของช่าง";
  const subtitle = role === "admin"
    ? "แจ้งเตือนเมื่อมีการจองคิวใหม่และคำสั่งซื้อสินค้าใหม่"
    : "แจ้งเตือนทันทีเมื่อมีงานซ่อมถูกมอบหมายให้คุณ";

  return (
    <main className="notifications-page">
      <section className="notifications-hero">
        <div>
          <p className="notifications-kicker">{role === "admin" ? "ADMIN CENTER" : "TECHNICIAN CENTER"}</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {userId && unread > 0 ? (
          <button className="notifications-mark-all" disabled={marking} onClick={() => void markAll()} type="button">
            {marking ? "กำลังดำเนินการ..." : "อ่านทั้งหมด"}
          </button>
        ) : null}
      </section>

      {loading ? (
        <section className="notifications-empty"><p>กำลังโหลดการแจ้งเตือน...</p></section>
      ) : error ? (
        <section className="notifications-error"><strong>โหลดการแจ้งเตือนไม่สำเร็จ</strong><span>{error}</span></section>
      ) : items.length === 0 ? (
        <section className="notifications-empty">
          <div className="notifications-empty-icon">✓</div>
          <h2>ยังไม่มีการแจ้งเตือน</h2>
          <p>{subtitle}</p>
        </section>
      ) : (
        <section className="notifications-list" aria-label="รายการแจ้งเตือน">
          {items.map((item) => {
            const href = hrefFor(item, role);
            return (
              <button
                key={item.id}
                className={`notification-card ${item.is_read ? "is-read" : "is-unread"}`}
                onClick={() => {
                  void markRead(item.id).then(() => {
                    if (href) window.location.href = href;
                  });
                }}
                type="button"
              >
                <span className="notification-card__icon">{icons[item.type] ?? "🔔"}</span>
                <span className="notification-card__body">
                  <span className="notification-card__topline">
                    <span className="notification-card__title">{item.title}</span>
                    {!item.is_read ? <span className="notification-card__dot" /> : null}
                  </span>
                  {item.message ? <span className="notification-card__message">{item.message}</span> : null}
                  <span className="notification-card__time">
                    {timeText(item.created_at)}{href ? " · แตะเพื่อดูรายละเอียด" : ""}
                  </span>
                </span>
                <span className="notification-card__arrow">›</span>
              </button>
            );
          })}
        </section>
      )}
    </main>
  );
}
