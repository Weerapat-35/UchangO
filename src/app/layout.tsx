import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooterChrome } from "@/components/site-footer-chrome";
import "./globals.css";

// ฟอนต์หลักของทั้งเว็บ: Noto Sans Thai (variable font รองรับน้ำหนัก 100-900)
const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-sans-thai",
});

export const metadata: Metadata = {
  title: "อู่ช่างโอ",
  description: "ระบบบริการอู่ซ่อมรถอู่ช่างโอ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={notoSansThai.variable}
    >
      <body>
        <SiteChrome />
        {children}
        <SiteFooterChrome />
      </body>
    </html>
  );
}
