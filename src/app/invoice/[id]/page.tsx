import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InvoicePrintButton from "@/features/invoices/components/invoice-print-button";

function money(value: number) {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function thaiDate(value: string) {
  return new Date(value).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    redirect(`/auth?next=/invoice/${id}`);
  }

  const profileResult = await supabase
    .from("profiles")
    .select("id, full_name, phone_number, email, role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const isAdmin = profileResult.data?.role === "admin";
  const backHref = isAdmin ? `/admin/product-orders/${id}` : `/my-product-orders/${id}`;
  const orderResult = await supabase
    .from("product_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (orderResult.error || !orderResult.data) {
    notFound();
  }

  const order = orderResult.data;

  if (!isAdmin && order.customer_id !== auth.user.id) {
    notFound();
  }

  if (order.payment_status !== "paid") {
    return (
      <main className="min-h-screen bg-[#f5f6f8] p-6 text-slate-900">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 print:hidden">
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <span aria-hidden="true">←</span> กลับไปยังรายละเอียดคำสั่งซื้อ
            </Link>
          </div>
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-black">ยังออกเอกสารไม่ได้</h1>
            <p className="mt-3 text-slate-600">
              คำสั่งซื้อนี้ยังไม่ได้รับการยืนยันการชำระเงิน จึงยังไม่สามารถออกเอกสาร PDF ได้
            </p>
          </div>
        </div>
      </main>
    );
  }

  const [profile, itemsResult, settingsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone_number, email")
      .eq("id", order.customer_id)
      .maybeSingle(),
    supabase
      .from("product_order_items")
      .select("id, product_id, quantity, unit_price, total_price")
      .eq("product_order_id", order.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("invoice_settings")
      .select("*")
      .eq("setting_key", "default")
      .maybeSingle(),
  ]);

  const items = itemsResult.data ?? [];
  const productIds = items.map((item) => item.product_id);
  const productsResult = productIds.length
    ? await supabase.from("products").select("id, name, sku").in("id", productIds)
    : { data: [], error: null };
  const products = new Map((productsResult.data ?? []).map((product) => [product.id, product]));
  const settings = settingsResult.data;

  const subtotal = order.subtotal_amount;
  const deliveryFee = order.delivery_fee;
  const total = order.total_amount;
  const vatRate = Number(settings?.vat_rate ?? 7);
  const vatAmount = settings?.vat_registered
    ? settings.prices_include_vat
      ? total - total / (1 + vatRate / 100)
      : total * (vatRate / 100)
    : 0;
  const invoiceTotal = settings?.vat_registered && !settings.prices_include_vat
    ? total + vatAmount
    : total;
  const invoiceNumber = `INV-${new Date(order.created_at).toISOString().slice(0, 10).replaceAll("-", "")}-${order.order_number}`;

  return (
    <main className="invoice-page min-h-screen bg-[#f2f3f5] px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span aria-hidden="true">←</span> กลับไปยังรายละเอียดคำสั่งซื้อ
          </Link>
          <InvoicePrintButton />
        </div>

        <article className="invoice-paper overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,.10)] print:rounded-none print:border-0 print:shadow-none">
          <header className="invoice-header border-b-4 border-[#b5121b] p-8 sm:p-10">
            <div className="flex flex-col justify-between gap-8 sm:flex-row">
              <div>
                <div className="text-xs font-black tracking-[0.28em] text-[#b5121b]">OUCHANG O GARAGE</div>
                <h1 className="mt-2 text-3xl font-black text-slate-950">{settings?.shop_name ?? "อู่ช่างโอ"}</h1>
                <div className="mt-3 max-w-md whitespace-pre-line text-sm leading-6 text-slate-600">
                  {settings?.address || "-"}
                  {settings?.phone_number ? `\nโทร. ${settings.phone_number}` : ""}
                  {settings?.email ? `\n${settings.email}` : ""}
                  {settings?.tax_id ? `\nเลขประจำตัวผู้เสียภาษี: ${settings.tax_id}` : ""}
                  {settings?.branch_name ? `\nสาขา: ${settings.branch_name}${settings.branch_number ? ` (${settings.branch_number})` : ""}` : ""}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-sm font-semibold text-slate-500">{settings?.vat_registered ? "ใบกำกับภาษี / ใบเสร็จรับเงิน" : "ใบเสร็จรับเงิน"}</div>
                <div className="mt-2 text-2xl font-black text-slate-950">{invoiceNumber}</div>
                <div className="mt-2 text-sm text-slate-600">วันที่ {thaiDate(order.created_at)}</div>
                <div className="mt-1 text-sm text-slate-600">ออเดอร์ {order.order_number}</div>
              </div>
            </div>
          </header>

          <section className="grid gap-6 border-b border-slate-200 p-8 sm:grid-cols-2 sm:p-10">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-slate-400">ลูกค้า</div>
              <div className="mt-2 text-lg font-bold text-slate-950">{profile.data?.full_name ?? "-"}</div>
              <div className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">
                {profile.data?.phone_number ? `โทร. ${profile.data.phone_number}` : ""}
                {profile.data?.email ? `\n${profile.data.email}` : ""}
                {order.delivery_address ? `\n${order.delivery_address}` : "\nรับที่อู่"}
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-xs font-black uppercase tracking-widest text-slate-400">การชำระเงิน</div>
              <div className="mt-2 font-bold text-slate-950">ชำระเงินแล้ว</div>
              <div className="mt-1 text-sm text-slate-600">{order.delivery_method === "delivery" ? "จัดส่งถึงบ้าน" : "รับที่อู่"}</div>
            </div>
          </section>

          <section className="p-8 sm:p-10">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-900 text-left">
                  <th className="pb-3 pr-4">รายการ</th>
                  <th className="pb-3 px-2 text-center">จำนวน</th>
                  <th className="pb-3 px-2 text-right">ราคา/หน่วย</th>
                  <th className="pb-3 pl-2 text-right">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const product = products.get(item.product_id);
                  return (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-4 pr-4">
                        <div className="font-semibold text-slate-950">{product?.name ?? "สินค้า"}</div>
                        {product?.sku ? <div className="mt-1 text-xs text-slate-400">SKU: {product.sku}</div> : null}
                      </td>
                      <td className="px-2 py-4 text-center">{item.quantity}</td>
                      <td className="px-2 py-4 text-right">฿{money(item.unit_price)}</td>
                      <td className="py-4 pl-2 text-right font-semibold">฿{money(item.total_price)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="ml-auto mt-8 w-full max-w-sm space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">ค่าสินค้า</span><span>฿{money(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">ค่าจัดส่ง</span><span>฿{money(deliveryFee)}</span></div>
              {settings?.vat_registered ? <div className="flex justify-between"><span className="text-slate-500">VAT {vatRate}%</span><span>฿{money(vatAmount)}</span></div> : null}
              <div className="flex justify-between border-t-2 border-slate-900 pt-4 text-lg font-black"><span>ยอดสุทธิ</span><span>฿{money(invoiceTotal)}</span></div>
            </div>
          </section>

          <footer className="border-t border-slate-200 bg-slate-50 p-8 text-sm text-slate-500 sm:p-10 print:bg-white">
            <div className="flex flex-col justify-between gap-6 sm:flex-row">
              <div>
                <div className="font-bold text-slate-800">ขอบคุณที่ใช้บริการอู่ช่างโอ</div>
                <div className="mt-1">เอกสารนี้จัดทำจากระบบจัดการคำสั่งซื้อของอู่ช่างโอ</div>
              </div>
              <div className="text-left sm:text-right">เลขที่เอกสาร {invoiceNumber}</div>
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
}
