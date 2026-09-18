import type { Metadata } from "next";
import { Chakra_Petch, IBM_Plex_Sans_Thai } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

// ฟอนต์หัวเรื่อง: แนวเทคนิค/วิศวกรรม รองรับภาษาไทย เข้ากับธีมอู่ซ่อมรถ
const chakraPetch = Chakra_Petch({
  subsets: ["latin", "thai"],
  weight: ["500", "600", "700"],
  variable: "--font-chakra-petch",
});

// ฟอนต์เนื้อหา: อ่านง่าย รองรับภาษาไทยเต็มรูปแบบ
const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-thai",
});

export const metadata: Metadata = {
  title: "BCare | BigO-RepairCar",
  description: "Garage booking system for BigO-RepairCar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${chakraPetch.variable} ${plexThai.variable}`}>
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
