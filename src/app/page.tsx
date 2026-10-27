import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatThaiDate, formatTime } from "@/features/bookings/components/booking-ui";
import { bookingStatusLabel } from "@/lib/status-labels";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  let nextBooking: NextBooking | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    if (profile?.role === "admin") {
      redirect("/admin");
    }

    if (profile?.role === "technician") {
      redirect("/technician/dashboard");
    }

    displayName = profile?.full_name?.trim().split(/\s+/)[0] || null;
    nextBooking = await getNextBooking(supabase, user.id);
  }

  return (
    <main className="storefront-main home-page">
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero__content">
          <p className="home-eyebrow home-eyebrow--light">
            {displayName ? `สวัสดี คุณ${displayName}` : "ศูนย์บริการรถยนต์"}
          </p>
          <h1 id="home-hero-title">
            อู่ช่างโอ
            <span><span className="home-nowrap">ดูแลรถของคุณ</span> <span className="home-nowrap">เหมือนรถของเรา</span></span>
          </h1>
          <p className="home-hero__lead">
            ซ่อมรถครบวงจรโดยทีมช่างมืออาชีพ จองคิวออนไลน์ได้เอง และติดตามสถานะงานซ่อมได้ทุกขั้นตอน
          </p>
          <div className="home-hero__actions">
            <Link href="/services" className="garage-btn-primary">เลือกบริการและจองคิว</Link>
            <Link href="/products" className="garage-btn-secondary">ดูสินค้าและอะไหล่</Link>
          </div>
        </div>
      </section>

      <ul className="home-quick" aria-label="เมนูลัด">
        {quickLinks.map((item) => (
          <li key={item.title}>
            <Link href={item.href} className={`home-quick__item${item.primary ? " home-quick__item--primary" : ""}`}>
              <span className="home-quick__icon" aria-hidden="true">{item.icon}</span>
              <span className="home-quick__text">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {nextBooking ? (
        <section className="home-next" aria-labelledby="home-next-title">
          <div>
            <p className="home-next__label">คิวถัดไปของคุณ</p>
            <h2 id="home-next-title">{nextBooking.serviceName}</h2>
            <p>{formatThaiDate(nextBooking.date)} • {formatTime(nextBooking.time)}</p>
            <span className={`home-next__badge home-next__badge--${nextBooking.status}`}>
              {bookingStatusLabel(nextBooking.status)}
            </span>
          </div>
          <Link href={`/my-bookings/${nextBooking.id}`} className="garage-btn-primary">ดูรายละเอียดการจอง</Link>
        </section>
      ) : null}

      <section className="home-block home-block--first" aria-labelledby="home-steps-title">
        <div className="home-heading">
          <p className="home-eyebrow">ใช้บริการง่าย</p>
          <h2 id="home-steps-title">จองคิวซ่อมรถใน 3 ขั้นตอน</h2>
        </div>
        <ol className="home-steps">
          {steps.map((step, index) => (
            <li key={step.title} className="home-step">
              <span className="home-step__number" aria-hidden="true">{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-block" aria-labelledby="home-services-title">
        <div className="home-heading home-heading--split">
          <div>
            <p className="home-eyebrow">บริการของเรา</p>
            <h2 id="home-services-title">บริการครบ จบที่อู่ช่างโอ</h2>
            <p>เลือกบริการที่ต้องการ แล้วจองวันและเวลาที่สะดวกได้ทันที</p>
          </div>
          <Link href="/services" className="home-link">ดูบริการทั้งหมด <span aria-hidden="true">→</span></Link>
        </div>
        <div className="home-services">
          {services.map((service) => (
            <Link key={service.title} href="/services" className="home-service">
              <span className="home-service__icon" aria-hidden="true">{service.icon}</span>
              <span className="home-service__text">
                <strong>{service.title}</strong>
                <span>{service.description}</span>
              </span>
              <span className="home-service__arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-cta" aria-labelledby="home-cta-title">
        <div>
          <h2 id="home-cta-title">พร้อมให้เราดูแลรถของคุณแล้วหรือยัง?</h2>
          <p>เลือกบริการและวันเวลาที่สะดวก ทีมช่างของเราพร้อมดูแล</p>
        </div>
        <Link href="/services" className="garage-btn-primary">เลือกบริการและจองคิว</Link>
      </section>
    </main>
  );
}

const steps = [
  { title: "เลือกบริการ", description: "ดูรายละเอียดบริการทั้งหมด แล้วเลือกบริการที่รถของคุณต้องการ" },
  { title: "เลือกวันและเวลา", description: "ระบุข้อมูลรถ แล้วเลือกวันเวลาที่สะดวกจากคิวที่ว่าง" },
  { title: "ติดตามงานซ่อม", description: "ดูสถานะการจองและความคืบหน้างานซ่อมได้ที่หน้าจองคิว" },
];

type NextBooking = {
  date: string;
  id: string;
  serviceName: string;
  status: string;
  time: string;
};

// วันนี้ตามเวลาประเทศไทย (รูปแบบ YYYY-MM-DD) กันกรณีเซิร์ฟเวอร์ใช้เวลา UTC แล้ววันที่เพี้ยน
function getTodayInBangkok() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

// คิวที่ใกล้ถึงที่สุดของลูกค้า (เฉพาะที่ยังรอยืนยันหรือยืนยันแล้ว) ถ้าไม่มีหรือโหลดไม่ได้ให้ซ่อนการ์ด
async function getNextBooking(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
): Promise<NextBooking | null> {
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, booking_date, booking_time, status, service_id")
    .eq("customer_id", customerId)
    .in("status", ["pending", "confirmed"])
    .gte("booking_date", getTodayInBangkok())
    .order("booking_date", { ascending: true })
    .order("booking_time", { ascending: true })
    .limit(1);

  const booking = bookings?.[0];
  if (!booking) {
    return null;
  }

  const { data: service } = await supabase
    .from("services")
    .select("name")
    .eq("id", booking.service_id)
    .maybeSingle();

  return {
    date: booking.booking_date,
    id: booking.id,
    serviceName: service?.name ?? "บริการที่จองไว้",
    status: booking.status,
    time: booking.booking_time,
  };
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const quickLinks = [
  {
    title: "จองคิวซ่อมรถ",
    description: "เลือกบริการ วัน และเวลา",
    href: "/services",
    primary: true,
    icon: <Icon><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4M12 13v4M10 15h4" /></Icon>,
  },
  {
    title: "ติดตามงานซ่อม",
    description: "ดูสถานะการจองและงานซ่อม",
    href: "/my-bookings",
    primary: false,
    icon: <Icon><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="m9 14 2 2 4-4" /></Icon>,
  },
  {
    title: "รถของฉัน",
    description: "บันทึกข้อมูลรถไว้ใช้ซ้ำ",
    href: "/my-vehicles",
    primary: false,
    icon: <Icon><path d="M3 13l2-5.2A2 2 0 0 1 6.9 6.5h10.2a2 2 0 0 1 1.9 1.3L21 13v5h-3v-2H6v2H3z" /><circle cx="7.5" cy="13" r="1" /><circle cx="16.5" cy="13" r="1" /></Icon>,
  },
  {
    title: "สินค้าและอะไหล่",
    description: "เลือกซื้อออนไลน์",
    href: "/products",
    primary: false,
    icon: <Icon><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></Icon>,
  },
];

const services = [
  {
    title: "ซ่อมทั่วไป",
    description: "ซ่อมเครื่องยนต์และระบบต่าง ๆ",
    icon: <Icon><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2 2.6-2.6Z" /></Icon>,
  },
  {
    title: "เปลี่ยนถ่ายน้ำมันเครื่อง",
    description: "น้ำมันเครื่องและไส้กรอง",
    icon: <Icon><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" /></Icon>,
  },
  {
    title: "ระบบเบรก",
    description: "ตรวจเช็กและเปลี่ยนผ้าเบรก",
    icon: <Icon><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M5 7a9 9 0 0 1 4-3" /></Icon>,
  },
  {
    title: "ช่วงล่างและยาง",
    description: "ยางรถยนต์และระบบช่วงล่าง",
    icon: <Icon><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v5M12 16v5M3 12h5M16 12h5" /></Icon>,
  },
  {
    title: "แบตเตอรี่",
    description: "ตรวจเช็กและเปลี่ยนแบตเตอรี่",
    icon: <Icon><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M7 7V4h3v3M14 7V4h3v3M7 13.5h4M15 11.5v4M13 13.5h4" /></Icon>,
  },
  {
    title: "แอร์รถยนต์",
    description: "ตรวจเช็กและซ่อมระบบแอร์",
    icon: <Icon><path d="M12 2v20M4.9 7l14.2 10M4.9 17 19.1 7M9 4l3 2 3-2M9 20l3-2 3 2" /></Icon>,
  },
];
