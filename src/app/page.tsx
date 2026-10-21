import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "admin") {
      redirect("/admin");
    }

    if (profile?.role === "technician") {
      redirect("/technician/dashboard");
    }
  }

  return (
    <main className="storefront-main home-page min-h-screen pb-12">
      <section className="garage-hero home-page__hero">
        <div className="hero-car-shape" aria-hidden="true" />
        <div className="garage-hero__content">
          <div className="garage-kicker">ศูนย์บริการรถยนต์</div>
          <h1>อู่ช่างโอ<br /><span>ดูแลรถของคุณ</span> เหมือนรถของเรา</h1>
          <p>บริการซ่อมรถครบวงจร ทีมช่างมืออาชีพ อะไหล่และสินค้าคุณภาพ พร้อมระบบจองคิวออนไลน์</p>
          <div className="garage-hero__actions">
            <Link href="/services" className="garage-btn-primary">เลือกบริการ</Link>
            <Link href="/products" className="garage-btn-secondary">ดูสินค้า</Link>
          </div>
        </div>
      </section>

      <section className="home-stats" aria-label="จุดเด่นของอู่ช่างโอ">
        <div className="home-stat-card"><strong>ครบ</strong><span>บริการซ่อมรถ</span></div>
        <div className="home-stat-card"><strong>มืออาชีพ</strong><span>ทีมช่างดูแลรถ</span></div>
        <div className="home-stat-card"><strong>ออนไลน์</strong><span>จองคิวได้สะดวก</span></div>
        <div className="home-stat-card"><strong>24/7</strong><span>ตรวจสอบข้อมูลบริการ</span></div>
      </section>

      <section className="home-section">
        <div className="store-section-title">
          <div>
            <span className="home-section__kicker">OUR SERVICES</span>
            <h2>บริการครบ จบที่อู่ช่างโอ</h2>
            <p>เลือกดูบริการที่ต้องการ แล้วจองคิวได้จากหน้าบริการ</p>
          </div>
          <Link href="/services" className="home-section__link">ดูบริการทั้งหมด →</Link>
        </div>

        <div className="home-service-grid">
          {[
            ["บริการซ่อมรถ", "ซ่อมเครื่องยนต์และระบบต่าง ๆ"],
            ["เปลี่ยนถ่ายน้ำมันเครื่อง", "น้ำมันเครื่องและไส้กรอง"],
            ["ระบบเบรก", "ตรวจเช็กและเปลี่ยนผ้าเบรก"],
            ["ช่วงล่างและยาง", "ยางรถยนต์และช่วงล่าง"],
            ["แบตเตอรี่", "ตรวจเช็กและเปลี่ยนแบตเตอรี่"],
            ["แอร์รถยนต์", "ตรวจเช็กและซ่อมระบบแอร์"],
          ].map(([title, description]) => (
            <Link key={title} href="/services" className="home-service-card">
              <span className="home-service-card__icon">⌁</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <span className="home-service-card__arrow">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-about">
        <div>
          <span className="home-section__kicker">ABOUT US</span>
          <h2>ดูแลรถด้วยความใส่ใจในทุกขั้นตอน</h2>
          <p>อู่ช่างโอออกแบบระบบบริการให้ลูกค้าดูข้อมูลบริการ เลือกบริการ จองคิว และติดตามงานได้ง่ายในที่เดียว</p>
        </div>
        <div className="home-about__grid">
          <div><strong>จองคิวออนไลน์</strong><span>เลือกบริการและเวลาที่สะดวกได้จากเว็บไซต์</span></div>
          <div><strong>ข้อมูลรถของฉัน</strong><span>จัดเก็บข้อมูลรถเพื่อใช้ในการจองบริการ</span></div>
          <div><strong>สินค้าและอะไหล่</strong><span>เลือกซื้อสินค้าและอะไหล่จากระบบออนไลน์</span></div>
          <div><strong>ติดตามงานซ่อม</strong><span>ตรวจสอบสถานะงานซ่อมได้สะดวก</span></div>
        </div>
      </section>

      <section className="home-hours">
        <div>
          <span className="home-section__kicker">GARAGE INFORMATION</span>
          <h2>พร้อมดูแลรถของคุณ</h2>
          <p>ก่อนเข้ารับบริการ สามารถตรวจสอบบริการและเลือกวันเวลาที่ต้องการจองได้จากระบบ</p>
          <Link href="/services" className="garage-btn-primary">เลือกบริการและจองคิว</Link>
        </div>
        <div className="home-hours__panel">
          <strong>บริการออนไลน์</strong>
          <div><span>ดูบริการ</span><b>24 ชม.</b></div>
          <div><span>ดูสินค้า</span><b>ออนไลน์</b></div>
          <div><span>จองคิว</span><b>ตามเวลาที่เปิดรับ</b></div>
        </div>
      </section>
    </main>
  );
}
