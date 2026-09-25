"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getCurrentProfile, type Profile } from "@/features/auth";
import { createClient } from "@/lib/supabase/browser";
import { getCartSummary } from "@/features/products/queries";

const guestLinks = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/services", label: "บริการ" },
  { href: "/products", label: "สินค้า" },
  { href: "/my-bookings", label: "จองคิว" },
  { href: "/my-vehicles", label: "รถของฉัน" },
];

const customerLinks = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/services", label: "บริการ" },
  { href: "/products", label: "สินค้า" },
  { href: "/my-bookings", label: "จองคิว" },
  { href: "/my-vehicles", label: "รถของฉัน" },
  { href: "/my-product-orders", label: "คำสั่งซื้อ" },
];

const technicianLinks = [
  { href: "/technician/work-orders", label: "งานซ่อมของฉัน" },
  { href: "/technician/profile", label: "โปรไฟล์ช่าง" },
];

const adminLinks = [
  { href: "/admin", label: "แดชบอร์ด" },
  { href: "/admin/bookings", label: "การจอง" },
  { href: "/admin/repair-jobs", label: "งานซ่อม" },
  { href: "/admin/schedule", label: "ตารางคิว" },
  { href: "/admin/products", label: "สินค้า" },
  { href: "/admin/product-orders", label: "ออเดอร์" },
  { href: "/admin/customers", label: "ลูกค้า" },
  { href: "/admin/reports", label: "รายงาน" },
];

function UserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c.7-3.5 3-5.2 7-5.2s6.3 1.7 7 5.2"/></svg>;
}
function CartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h2l1.4 10.2h9.8L19 8H7"/><circle cx="10" cy="19" r="1.2"/><circle cx="17" cy="19" r="1.2"/></svg>;
}
function BellIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
}

export function AppNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    async function loadProfile(nextUser: User | null) {
      if (!nextUser) {
        setProfile(null);
        return;
      }
      const { data } = await getCurrentProfile(supabase, nextUser.id);
      setProfile(data ?? null);
    }
    async function loadCartCount(nextUser: User | null) {
      if (!nextUser) {
        setCartCount(0);
        return null;
      }
      const { data } = await getCartSummary(supabase, nextUser.id);
      setCartCount(data?.itemCount ?? 0);
      return data?.cart?.id ?? null;
    }

    let cartChannel: ReturnType<typeof supabase.channel> | null = null;
    let notificationChannel: ReturnType<typeof supabase.channel> | null = null;

    const removeNotificationRealtime = () => {
      if (notificationChannel) {
        void supabase.removeChannel(notificationChannel);
        notificationChannel = null;
      }
    };

    const loadNotificationCount = async (nextUser: User | null) => {
      if (!nextUser) {
        setNotificationCount(0);
        return;
      }
      const { count, error } = await (supabase as any)
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", nextUser.id)
        .eq("is_read", false);
      if (!error) setNotificationCount(count ?? 0);
    };

    let notificationSetupToken = 0;

    const setupNotificationRealtime = async (nextUser: User | null) => {
      const setupToken = ++notificationSetupToken;
      removeNotificationRealtime();

      if (!nextUser) {
        setNotificationCount(0);
        return;
      }

      // IMPORTANT: register every postgres_changes callback BEFORE subscribe().
      // Also give every setup attempt a unique channel name. Auth can emit an
      // initial session while loadSession() is still running; reusing the same
      // channel name during that race can make Supabase reject .on() calls
      // with "cannot add callbacks ... after subscribe()".
      const channel = supabase
        .channel(`notification-badge-${nextUser.id}-${setupToken}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `customer_id=eq.${nextUser.id}`,
          },
          () => {
            void loadNotificationCount(nextUser);
          },
        );

      notificationChannel = channel;
      await loadNotificationCount(nextUser);

      // If another auth/session event replaced this channel while the count
      // query was running, do not subscribe the stale channel.
      if (setupToken !== notificationSetupToken || notificationChannel !== channel) {
        void supabase.removeChannel(channel);
        return;
      }

      await channel.subscribe();
    };

    const removeCartRealtime = () => {
      if (cartChannel) {
        void supabase.removeChannel(cartChannel);
        cartChannel = null;
      }
    };

    const setupCartRealtime = async (nextUser: User | null) => {
      removeCartRealtime();

      if (!nextUser) {
        setCartCount(0);
        return;
      }

      const cartId = await loadCartCount(nextUser);

      // Build every postgres_changes callback BEFORE subscribe().
      // Supabase does not allow adding callbacks after a channel is subscribed.
      let channel = supabase.channel(`cart-badge-${nextUser.id}-${Date.now()}`);

      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_carts",
          filter: `customer_id=eq.${nextUser.id}`,
        },
        () => {
          void loadCartCount(nextUser);
        },
      );

      if (cartId) {
        channel = channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "shopping_cart_items",
            filter: `shopping_cart_id=eq.${cartId}`,
          },
          () => {
            void loadCartCount(nextUser);
          },
        );
      } else {
        // No cart exists yet. Listen to cart-item changes without a cart filter
        // so the first cart/item creation can also refresh the badge.
        channel = channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "shopping_cart_items",
          },
          () => {
            void loadCartCount(nextUser);
          },
        );
      }

      cartChannel = channel;

      // subscribe() MUST be the final step after all .on(...) calls.
      await channel.subscribe();
    };

    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      void loadProfile(nextUser);
      void setupCartRealtime(nextUser);
      void setupNotificationRealtime(nextUser);
    }
    void loadSession();

    const handleCartUpdated = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      void loadCartCount(session?.user ?? null);
    };
    window.addEventListener("cart-updated", handleCartUpdated);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      void loadProfile(nextUser);
      void setupCartRealtime(nextUser);
      void setupNotificationRealtime(nextUser);
    });
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("cart-updated", handleCartUpdated);
      removeCartRealtime();
      removeNotificationRealtime();
    };
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const links = !user
    ? guestLinks
    : profile?.role === "admin"
      ? adminLinks
      : profile?.role === "technician"
        ? technicianLinks
        : customerLinks;

  if (pathname.startsWith("/admin") || pathname.startsWith("/technician") || pathname.startsWith("/auth")) {
    return null;
  }

  return (
    <header className="site-header">
      <div className="site-header__top">
        <div className="site-header__inner site-header__top-inner">
          <Link href="/" className="garage-logo" aria-label="อู่ช่างโอ หน้าหลัก">
            <span className="garage-logo__mark">อู่</span>
            <span className="garage-logo__text"><b>ช่างโอ</b><small>GARAGE SERVICE</small></span>
          </Link>

          <nav aria-label="เมนูหลัก" className="main-nav">
            {links.map((link) => {
              const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href} className={isActive ? "main-nav__link is-active" : "main-nav__link"}>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="site-actions">
            {user ? (
              <Link href="/notifications" className="header-icon-button header-notification" aria-label="การแจ้งเตือน" title="การแจ้งเตือน">
                <BellIcon />
                {notificationCount > 0 ? <span>{notificationCount > 99 ? "99+" : notificationCount}</span> : null}
              </Link>
            ) : null}
            <Link href={user ? "/profile" : "/auth"} className="header-icon-button" aria-label="บัญชี" title={user ? profile?.full_name || "โปรไฟล์" : "เข้าสู่ระบบ"}><UserIcon /></Link>
            <Link href="/cart" className="header-icon-button header-cart" aria-label="ตะกร้า" title="ตะกร้า"><CartIcon /><span>{cartCount}</span></Link>
            {user ? <button className="header-signout" onClick={handleSignOut} type="button">ออกจากระบบ</button> : null}
          </div>
        </div>
      </div>
    </header>
  );}
