"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

export function StaffNotificationBell({ role }: { role: "admin" | "technician" }) {
  const [count, setCount] = useState(0);
  const href = role === "admin" ? "/admin/notifications" : "/technician/notifications";

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let setupToken = 0;

    const loadCount = async (userId: string) => {
      const { count: nextCount, error } = await (supabase as any)
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", userId)
        .eq("is_read", false);
      if (mounted && !error) setCount(nextCount ?? 0);
    };

    const start = async () => {
      const token = ++setupToken;
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted || !session?.user) return;

      if (channel) await supabase.removeChannel(channel);
      const userId = session.user.id;
      channel = supabase
        .channel(`staff-notifications-${role}-${userId}-${token}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `customer_id=eq.${userId}`,
          },
          () => void loadCount(userId),
        );

      await loadCount(userId);
      if (!mounted || token !== setupToken || !channel) return;
      await channel.subscribe();
    };

    void start();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => void start());

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [role]);

  return (
    <Link
      href={href}
      className="staff-notification-bell"
      aria-label="การแจ้งเตือน"
      title="การแจ้งเตือน"
    >
      <BellIcon />
      {count > 0 ? <span>{count > 99 ? "99+" : count}</span> : null}
    </Link>
  );
}
