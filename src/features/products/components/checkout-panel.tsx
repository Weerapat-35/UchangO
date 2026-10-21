"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import {
  createProductOrderFromCart,
  getCartDetails,
  type CartDetails,
  type CheckoutDeliveryMethod,
  type CheckoutResult,
} from "@/features/products";
import { ProductImageThumb } from "./product-image-thumb";
import type { ReverseAddressDetails } from "./location-map";
const LocationMap = dynamic(
  () => import("./location-map").then((module) => module.LocationMap),
  { ssr: false },
);
import { emptyThaiAddress, ThaiAddressForm, type ThaiAddressValue } from "./thai-address-form";

type AuthState =
  | { status: "loading"; user: null; error: null }
  | { status: "signed-out"; user: null; error: null }
  | { status: "ready"; user: User; error: null }
  | { status: "error"; user: null; error: string };

type CartLoadState =
  | { status: "idle"; details: CartDetails; error: null }
  | { status: "loading"; details: CartDetails; error: null }
  | { status: "ready"; details: CartDetails; error: null }
  | { status: "error"; details: CartDetails; error: string };

type CheckoutState =
  | { status: "idle"; result: null; error: null }
  | { status: "submitting"; result: null; error: null }
  | { status: "success"; result: CheckoutResult; error: null }
  | { status: "error"; result: null; error: string };

const emptyCartDetails: CartDetails = {
  cart: null,
  itemCount: 0,
  items: [],
  subtotal: 0,
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

const deliveryFee = 60;

export function CheckoutPanel() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>({
    error: null,
    status: "loading",
    user: null,
  });
  const [cartState, setCartState] = useState<CartLoadState>({
    details: emptyCartDetails,
    error: null,
    status: "idle",
  });
  const [deliveryMethod, setDeliveryMethod] =
    useState<CheckoutDeliveryMethod>("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [thaiAddress, setThaiAddress] = useState<ThaiAddressValue>(emptyThaiAddress());
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [note, setNote] = useState("");
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({
    error: null,
    result: null,
    status: "idle",
  });

  async function syncThaiAddressFromMap(details: ReverseAddressDetails) {
    const next = { ...thaiAddress };

    if (details.houseNumber) next.houseNumber = details.houseNumber;
    if (details.road) next.road = details.road;
    if (details.soi) next.soi = details.soi;
    if (details.postalCode) next.postalCode = details.postalCode;

    const normalize = (text: string) => text
      .replace(/^(จังหวัด|จ\.)\s*/i, "")
      .replace(/^(อำเภอ|อ\.|เขต)\s*/i, "")
      .replace(/^(ตำบล|ต\.|แขวง)\s*/i, "")
      .trim();

    try {
      const base = "https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest";
      const provinceRes = await fetch(`${base}/province.json`);
      if (!provinceRes.ok) throw new Error("province lookup failed");
      const provinces = (await provinceRes.json()) as Array<{ id: number; name_th: string }>;
      const provinceName = normalize(details.province ?? "");
      const province = provinces.find((p) => normalize(p.name_th) === provinceName);

      if (province) {
        next.provinceId = String(province.id);
        next.province = province.name_th;

        const districtRes = await fetch(`${base}/district.json`);
        if (!districtRes.ok) throw new Error("district lookup failed");
        const districts = (await districtRes.json()) as Array<{ id: number; province_id: number; name_th: string }>;
        const provinceDistricts = districts.filter((d) => d.province_id === province.id);
        const districtName = normalize(details.district ?? "");
        const district = provinceDistricts.find((d) => normalize(d.name_th) === districtName);

        if (district) {
          next.districtId = String(district.id);
          next.district = district.name_th;

          const subRes = await fetch(`${base}/sub_district.json`);
          if (!subRes.ok) throw new Error("subdistrict lookup failed");
          const subdistricts = (await subRes.json()) as Array<{ id: number; district_id: number; zip_code: number | string; name_th: string }>;
          const districtSubs = subdistricts.filter((s) => s.district_id === district.id);
          const subdistrictName = normalize(details.subdistrict ?? "");
          const subdistrict = districtSubs.find((s) => normalize(s.name_th) === subdistrictName);

          if (subdistrict) {
            next.subdistrictId = String(subdistrict.id);
            next.subdistrict = subdistrict.name_th;
            if (!details.postalCode) next.postalCode = String(subdistrict.zip_code);
          }
        }
      }
    } catch {
      // Keep the map pin even if the Thai address dataset cannot be reached.
    }

    setThaiAddress(next);
  }

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadAuthState() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthState({
          error: error.message,
          status: "error",
          user: null,
        });
        return;
      }

      if (!session?.user) {
        setAuthState({
          error: null,
          status: "signed-out",
          user: null,
        });
        return;
      }

      setAuthState({
        error: null,
        status: "ready",
        user: session.user,
      });
    }

    loadAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadAuthState();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadCart() {
      if (authState.status !== "ready") {
        setCartState({
          details: emptyCartDetails,
          error: null,
          status: "idle",
        });
        return;
      }

      setCartState((currentState) => ({
        details: currentState.details,
        error: null,
        status: "loading",
      }));

      const supabase = createClient();
      const { data, error } = await getCartDetails(supabase, authState.user.id);

      if (!isMounted) {
        return;
      }

      if (error) {
        setCartState((currentState) => ({
          details: currentState.details,
          error: error.message,
          status: "error",
        }));
        return;
      }

      setCartState({
        details: data ?? emptyCartDetails,
        error: null,
        status: "ready",
      });
    }

    loadCart();

    return () => {
      isMounted = false;
    };
  }, [authState]);

  const resolvedDeliveryFee =
    deliveryMethod === "delivery" && cartState.details.itemCount > 0
      ? deliveryFee
      : 0;
  const totalAmount = cartState.details.subtotal + resolvedDeliveryFee;
  const canSubmit =
    cartState.details.items.length > 0 &&
    totalAmount > 0 &&
    checkoutState.status !== "submitting" &&
    checkoutState.status !== "success";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (authState.status !== "ready") {
      return;
    }

    setCheckoutState({
      error: null,
      result: null,
      status: "submitting",
    });

    const supabase = createClient();

    if (deliveryMethod === "delivery") {
      if (!recipientName.trim() || !phoneNumber.trim()) {
        setCheckoutState({
          error: "กรุณากรอกชื่อผู้รับและเบอร์โทรศัพท์",
          result: null,
          status: "error",
        });
        return;
      }
      if (
        !thaiAddress.houseNumber.trim() ||
        !thaiAddress.provinceId ||
        !thaiAddress.districtId ||
        !thaiAddress.subdistrictId ||
        !thaiAddress.postalCode ||
        !location
      ) {
        setCheckoutState({
          error: "กรุณากรอกบ้านเลขที่ และเลือกจังหวัด อำเภอ ตำบลให้ครบ พร้อมปักหมุดแผนที่",
          result: null,
          status: "error",
        });
        return;
      }

      const formattedAddress = [
        thaiAddress.houseNumber && `บ้านเลขที่ ${thaiAddress.houseNumber}`,
        thaiAddress.moo && `หมู่ ${thaiAddress.moo}`,
        thaiAddress.soi && `ซอย${thaiAddress.soi}`,
        thaiAddress.road && `ถนน${thaiAddress.road}`,
        thaiAddress.subdistrict && `ตำบล${thaiAddress.subdistrict}`,
        thaiAddress.district && `อำเภอ${thaiAddress.district}`,
        thaiAddress.province && `จังหวัด${thaiAddress.province}`,
        thaiAddress.postalCode,
      ].filter(Boolean).join(" ");

      setDeliveryAddress(formattedAddress);

      const { error: addressError } = await (supabase as any)
        .from("delivery_addresses")
        .insert({
          customer_id: authState.user.id,
          recipient_name: recipientName.trim(),
          phone_number: phoneNumber.trim(),
          address_line: formattedAddress,
          house_number: thaiAddress.houseNumber.trim(),
          moo: thaiAddress.moo.trim() || null,
          soi: thaiAddress.soi.trim() || null,
          road: thaiAddress.road.trim() || null,
          subdistrict: thaiAddress.subdistrict,
          district: thaiAddress.district,
          province: thaiAddress.province,
          postal_code: thaiAddress.postalCode,
          latitude: location.latitude,
          longitude: location.longitude,
          place_id: null,
        });

      if (addressError) {
        setCheckoutState({
          error: `บันทึกที่อยู่ไม่สำเร็จ: ${addressError.message}`,
          result: null,
          status: "error",
        });
        return;
      }
    }

    const { data, error } = await createProductOrderFromCart(
      supabase,
      authState.user.id,
      {
        deliveryAddress:
          deliveryMethod === "delivery"
            ? `${recipientName.trim()} ${phoneNumber.trim()} ${deliveryAddress.trim()}`
            : null,
        deliveryFee: resolvedDeliveryFee,
        deliveryMethod,
        note: note.trim() || null,
      },
    );

    if (error) {
      setCheckoutState({
        error: error.message,
        result: null,
        status: "error",
      });
      return;
    }

    if (!data) {
      setCheckoutState({
        error: "ไม่สามารถสร้างคำสั่งซื้อได้",
        result: null,
        status: "error",
      });
      return;
    }

    setCheckoutState({
      error: null,
      result: data,
      status: "success",
    });
    setCartState({
      details: emptyCartDetails,
      error: null,
      status: "ready",
    });
    router.push(`/my-product-orders/${data.order.id}#payment`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
      <header className="border-b border-[var(--line)] pb-5">
        <h1 className="text-3xl font-bold leading-tight text-[var(--foreground)]">
          ยืนยันคำสั่งซื้อสินค้า
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          เลือกวิธีรับสินค้า ตรวจยอดรวม แล้วสร้างคำสั่งซื้อจากตะกร้าปัจจุบัน
        </p>
      </header>

      {authState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังตรวจสอบบัญชี...
          </div>
        </section>
      ) : null}

      {authState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อน checkout</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่หน้าบัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {authState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-sm">
            {authState.error}
          </div>
        </section>
      ) : null}

      {authState.status === "ready" ? (
        <section className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <form
            className="space-y-5 rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm"
            onSubmit={handleSubmit}
          >
            {cartState.status === "loading" ? (
              <div className="rounded-lg border border-[var(--line)] bg-[var(--color-concrete-2)] p-4 text-sm text-[var(--muted)]">
                กำลังโหลดตะกร้า...
              </div>
            ) : null}

            {cartState.status === "error" ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                {cartState.error}
              </div>
            ) : null}

            {cartState.status === "ready" &&
            cartState.details.items.length === 0 &&
            checkoutState.status !== "success" ? (
              <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--color-concrete-2)] p-4 text-sm leading-6 text-[var(--muted)]">
                <p className="font-semibold text-[var(--foreground)]">
                  ตะกร้าว่างอยู่
                </p>
                <Link
                  className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                  href="/products"
                >
                  ไปเลือกสินค้า
                </Link>
              </div>
            ) : null}

            <fieldset className="grid gap-3">
              <legend className="text-sm font-semibold text-[var(--foreground)]">
                วิธีรับสินค้า
              </legend>
              <label className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--line)] bg-white px-4 text-sm text-[var(--foreground)]">
                <input
                  checked={deliveryMethod === "pickup"}
                  name="deliveryMethod"
                  onChange={() => setDeliveryMethod("pickup")}
                  type="radio"
                />
                รับที่อู่ BigO-RepairCar
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--line)] bg-white px-4 text-sm text-[var(--foreground)]">
                <input
                  checked={deliveryMethod === "delivery"}
                  name="deliveryMethod"
                  onChange={() => setDeliveryMethod("delivery")}
                  type="radio"
                />
                จัดส่งถึงบ้าน +{currencyFormatter.format(deliveryFee)}
              </label>
            </fieldset>

            {deliveryMethod === "delivery" ? (
              <section className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--color-concrete-2)] p-4 sm:p-5">
                <div>
                  <p className="text-base font-bold text-[var(--foreground)]">📍 ที่อยู่จัดส่ง</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">กรอกข้อมูลผู้รับ แล้วเลือกตำแหน่งจากแผนที่</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                    ชื่อผู้รับ
                    <input
                      className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--brand)]"
                      onChange={(event) => setRecipientName(event.target.value)}
                      placeholder="ชื่อ-นามสกุล"
                      required
                      value={recipientName}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                    เบอร์โทรศัพท์
                    <input
                      className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--brand)]"
                      onChange={(event) => setPhoneNumber(event.target.value)}
                      placeholder="08x-xxx-xxxx"
                      required
                      value={phoneNumber}
                    />
                  </label>
                </div>

                <ThaiAddressForm value={thaiAddress} onChange={setThaiAddress} />

                <button
                  type="button"
                  onClick={() => setShowMap(true)}
                  className="flex min-h-12 w-full items-center justify-between rounded-xl border border-[var(--brand)] bg-white px-4 text-left shadow-sm transition hover:bg-red-50"
                >
                  <span>
                    <span className="block text-sm font-bold text-[var(--foreground)]">🗺️ เลือกตำแหน่งจากแผนที่</span>
                    <span className="mt-1 block text-xs text-[var(--muted)]">
                      {location ? location.address : "กดเพื่อปักหมุดบ้าน/สถานที่จัดส่ง"}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-[var(--brand)]">เลือก →</span>
                </button>

                {location ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    ✓ เลือกพิกัดแล้ว: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </div>
                ) : null}
              </section>
            ) : null}

            <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
              หมายเหตุ
              <textarea
                className="min-h-24 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                onChange={(event) => setNote(event.target.value)}
                placeholder="เช่น ขอให้โทรก่อนจัดส่ง"
                value={note}
              />
            </label>

            {checkoutState.status === "error" ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                {checkoutState.error}
              </div>
            ) : null}

            {cartState.details.items.length > 0 && totalAmount <= 0 ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                ยอดรวมคำสั่งซื้อนี้เป็น 0 บาท กรุณาให้แอดมินตั้งราคาสินค้าก่อนสร้างคำสั่งซื้อ
              </div>
            ) : null}

            {checkoutState.status === "success" ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-[var(--brand-strong)]">
                <p className="font-semibold">สร้างคำสั่งซื้อแล้ว</p>
                <p className="mt-2">
                  เลขคำสั่งซื้อ: {checkoutState.result.order.order_number}
                </p>
                <p className="mt-1">
                  ยอดรวม:{" "}
                  {currencyFormatter.format(
                    checkoutState.result.order.total_amount,
                  )}
                </p>
                <p className="mt-1">
                  ระบบตัดสต๊อกและบันทึก inventory movement แล้ว
                </p>
                <p className="mt-1">กำลังพาไปหน้าชำระเงิน...</p>
              </div>
            ) : null}

            <button
              className="min-h-11 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canSubmit}
              type="submit"
            >
              {checkoutState.status === "submitting"
                ? "กำลังสร้างคำสั่งซื้อ..."
                : checkoutState.status === "success"
                  ? "สร้างคำสั่งซื้อแล้ว"
                  : "ยืนยันคำสั่งซื้อ"}
            </button>
          </form>

          <aside className="h-fit rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <p className="text-sm font-semibold text-[var(--brand)]">
              สรุปคำสั่งซื้อ
            </p>
            <div className="mt-4 space-y-3">
              {cartState.details.items.map((item) => (
                <div
                  className="border-b border-[var(--line)] pb-3 text-sm"
                  key={item.id}
                >
                  <div className="flex gap-3">
                    <ProductImageThumb
                      alt={`รูปสินค้า ${item.product?.name ?? "สินค้า"}`}
                      size="sm"
                      src={item.product?.image_url}
                    />
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">
                        {item.product?.name ?? "สินค้า"}
                      </p>
                      <p className="mt-1 text-[var(--muted)]">
                        {item.quantity} x{" "}
                        {currencyFormatter.format(item.product?.unit_price ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--muted)]">ยอดสินค้า</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {currencyFormatter.format(cartState.details.subtotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--muted)]">ค่าจัดส่ง</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {currencyFormatter.format(resolvedDeliveryFee)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-[var(--line)] pt-3">
                <dt className="text-[var(--muted)]">ยอดรวม</dt>
                <dd className="text-xl font-bold text-[var(--foreground)]">
                  {currencyFormatter.format(totalAmount)}
                </dd>
              </div>
            </dl>
            <Link
              className="mt-5 flex min-h-10 items-center justify-center rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
              href="/cart"
            >
              กลับไปแก้ตะกร้า
            </Link>
          </aside>
        </section>
      ) : null}

      {showMap ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--foreground)]">เลือกตำแหน่งจัดส่ง</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">คลิกบนแผนที่ หรือค้นหาสถานที่ แล้วกดยืนยัน</p>
              </div>
              <button type="button" onClick={() => setShowMap(false)} className="rounded-full px-3 py-2 text-lg text-[var(--muted)] hover:bg-gray-100">✕</button>
            </div>
            <div className="p-5">
              <LocationMap
                value={location}
                onChange={setLocation}
                onAddressDetails={(details) => {
                  void syncThaiAddressFromMap(details);
                }}
                searchQuery={[
                  thaiAddress.houseNumber && `บ้านเลขที่ ${thaiAddress.houseNumber}`,
                  thaiAddress.moo && `หมู่ ${thaiAddress.moo}`,
                  thaiAddress.soi && `ซอย${thaiAddress.soi}`,
                  thaiAddress.road && `ถนน${thaiAddress.road}`,
                  thaiAddress.subdistrict && `ตำบล${thaiAddress.subdistrict}`,
                  thaiAddress.district && `อำเภอ${thaiAddress.district}`,
                  thaiAddress.province && `จังหวัด${thaiAddress.province}`,
                  thaiAddress.postalCode,
                ].filter(Boolean).join(" ")}
              />
              <div className="mt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowMap(false)} className="rounded-xl border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]">ยกเลิก</button>
                <button
                  type="button"
                  disabled={!location}
                  onClick={() => {
                    if (location) {
                      setDeliveryAddress(location.address);
                      setShowMap(false);
                    }
                  }}
                  className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  ✓ ใช้ตำแหน่งนี้
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
