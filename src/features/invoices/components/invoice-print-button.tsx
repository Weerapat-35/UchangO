"use client";

export default function InvoicePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-[#b5121b] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#941018]"
    >
      🧾 พิมพ์ / บันทึกเป็น PDF
    </button>
  );
}
