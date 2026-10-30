"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

// QR ให้พนักงานสแกนตอนลูกค้าถึงอู่ เปิดหน้า /checkin/<id> เพื่อยืนยันว่าลูกค้ามาถึงแล้ว
export function CheckinQr({ bookingId, checkedInAt }: { bookingId: string; checkedInAt: string | null }) {
  const [checkinUrl, setCheckinUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = `${window.location.origin}/checkin/${bookingId}`;
    let isMounted = true;

    void QRCode.toDataURL(url, { margin: 1, width: 220 }).then((dataUrl) => {
      if (!isMounted) return;
      setCheckinUrl(url);
      setQrDataUrl(dataUrl);
    });

    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  if (checkedInAt) {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
        ✓ เช็กอินที่อู่แล้วเมื่อ{" "}
        {new Date(checkedInAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-[var(--color-concrete-2)] p-4 text-center sm:flex-row sm:text-left">
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL ที่สร้างในเครื่อง ไม่ต้องผ่าน next/image
        <img
          alt="QR Code สำหรับเช็กอินที่อู่"
          className="h-40 w-40 rounded-lg bg-white p-2"
          data-checkin-url={checkinUrl ?? undefined}
          src={qrDataUrl}
        />
      ) : (
        <div className="h-40 w-40 animate-pulse rounded-lg bg-white" />
      )}
      <div>
        <p className="text-sm font-bold text-[var(--foreground)]">QR สำหรับเช็กอิน</p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          เมื่อถึงอู่ ให้พนักงานสแกน QR นี้เพื่อยืนยันว่าคุณมาถึงแล้ว
        </p>
      </div>
    </div>
  );
}
