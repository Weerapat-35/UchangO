"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import {
  addProductToCart,
  getCartSummary,
  getStorefrontProducts,
  type CartSummary,
  type ProductCategoryWithProducts,
  type ProductWithCategory,
} from "@/features/products";

type AuthState =
  | { status: "loading"; user: null; error: null }
  | { status: "signed-out"; user: null; error: null }
  | { status: "ready"; user: User; error: null }
  | { status: "error"; user: null; error: string };

type ProductsState =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: null; error: null }
  | {
      status: "ready";
      data: {
        categories: ProductCategoryWithProducts[];
        products: ProductWithCategory[];
        uncategorizedProducts: ProductWithCategory[];
      };
      error: null;
    }
  | { status: "error"; data: null; error: string };

type CartState =
  | { status: "idle"; summary: CartSummary; error: null }
  | { status: "loading"; summary: CartSummary; error: null }
  | { status: "ready"; summary: CartSummary; error: null }
  | { status: "error"; summary: CartSummary; error: string };

type AddToCartState =
  | { status: "idle"; productId: null; message: null }
  | { status: "adding"; productId: string; message: null }
  | { status: "success"; productId: string; message: string }
  | { status: "error"; productId: string; message: string };

type SortMode = "relevant" | "latest" | "price-asc" | "price-desc";

const emptyCartSummary: CartSummary = { cart: null, itemCount: 0 };
const productImagePlaceholder = "/product-placeholder.svg";
const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function handleProductImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.src.endsWith(productImagePlaceholder)) return;
  image.src = productImagePlaceholder;
  image.alt = "ภาพสินค้าเริ่มต้น";
}

function stockText(product: ProductWithCategory) {
  if (product.stock_quantity <= 0) return "สินค้าหมด";
  return `มีสินค้า · ${product.stock_quantity} ชิ้น`;
}

function ProductCard({
  addToCartState,
  onAddToCart,
  product,
}: {
  addToCartState: AddToCartState;
  onAddToCart: (product: ProductWithCategory) => void;
  product: ProductWithCategory;
}) {
  const isAdding =
    addToCartState.status === "adding" && addToCartState.productId === product.id;
  const isOutOfStock = product.stock_quantity <= 0;

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[16px] border border-[#dedede] bg-white transition duration-200 hover:-translate-y-1 hover:border-[#c8c8c8] hover:shadow-[0_14px_30px_rgba(0,0,0,.08)]">
      <div className="relative flex h-[210px] items-center justify-center overflow-hidden bg-white p-4">
        <img
          alt={`รูปสินค้า ${product.name}`}
          className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]"
          onError={handleProductImageError}
          src={product.image_url || productImagePlaceholder}
        />
        {isOutOfStock ? (
          <span className="absolute left-3 top-3 rounded-full bg-[#171717] px-3 py-1 text-[11px] font-bold text-white">
            หมดสต๊อก
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col border-t border-[#ededed] p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[#d71920]">
          {product.category?.name ?? "สินค้า"}
        </p>
        <h2 className="mt-2 line-clamp-2 min-h-[48px] text-[16px] font-extrabold leading-6 text-[#151515]">
          {product.name}
        </h2>

        <div className="mt-3 flex items-center gap-2 text-[12px] text-[#777]">
          <span
            className={`h-2 w-2 rounded-full ${isOutOfStock ? "bg-[#d71920]" : "bg-[#222]"}`}
          />
          <span>{stockText(product)}</span>
        </div>

        <div className="mt-auto pt-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <strong className="text-[21px] font-black tracking-tight text-[#151515]">
              {currencyFormatter.format(product.unit_price)}
            </strong>
            {product.sku ? (
              <span className="max-w-[105px] truncate text-[10px] font-semibold text-[#999]">
                {product.sku}
              </span>
            ) : null}
          </div>
          <button
            className="min-h-10 w-full rounded-[9px] bg-[#d71920] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#b91218] disabled:cursor-not-allowed disabled:bg-[#bdbdbd]"
            disabled={isOutOfStock || isAdding}
            onClick={() => onAddToCart(product)}
            type="button"
          >
            {isOutOfStock ? "สินค้าหมด" : isAdding ? "กำลังเพิ่ม..." : "หยิบใส่ตะกร้า"}
          </button>
        </div>
      </div>
    </article>
  );
}

function SidebarCategory({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-[13px] font-semibold text-[#333]">
      <input
        checked={checked}
        className="h-4 w-4 accent-[#d71920]"
        onChange={onChange}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

export function ProductStorefront() {
  const [authState, setAuthState] = useState<AuthState>({
    error: null,
    status: "loading",
    user: null,
  });
  const [productsState, setProductsState] = useState<ProductsState>({
    data: null,
    error: null,
    status: "idle",
  });
  const [cartState, setCartState] = useState<CartState>({
    error: null,
    status: "idle",
    summary: emptyCartSummary,
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("relevant");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [addToCartState, setAddToCartState] = useState<AddToCartState>({
    message: null,
    productId: null,
    status: "idle",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadAuthState() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!isMounted) return;
      if (error) {
        setAuthState({ error: error.message, status: "error", user: null });
        return;
      }
      if (!session?.user) {
        setAuthState({ error: null, status: "signed-out", user: null });
        return;
      }
      setAuthState({ error: null, status: "ready", user: session.user });
    }

    void loadAuthState();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => void loadAuthState());

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      if (authState.status !== "ready") {
        setProductsState({ data: null, error: null, status: "idle" });
        return;
      }

      setProductsState({ data: null, error: null, status: "loading" });
      const supabase = createClient();
      const { data, error } = await getStorefrontProducts(supabase);
      if (!isMounted) return;

      if (error) {
        setProductsState({ data: null, error: error.message, status: "error" });
        return;
      }
      setProductsState({ data, error: null, status: "ready" });
    }

    void loadProducts();
    return () => {
      isMounted = false;
    };
  }, [authState.status]);

  useEffect(() => {
    let isMounted = true;

    async function loadCartSummary() {
      if (authState.status !== "ready") {
        setCartState({ error: null, status: "idle", summary: emptyCartSummary });
        return;
      }

      setCartState((current) => ({ error: null, status: "loading", summary: current.summary }));
      const supabase = createClient();
      const { data, error } = await getCartSummary(supabase, authState.user.id);
      if (!isMounted) return;

      if (error) {
        setCartState((current) => ({ error: error.message, status: "error", summary: current.summary }));
        return;
      }
      setCartState({ error: null, status: "ready", summary: data ?? emptyCartSummary });
    }

    void loadCartSummary();
    return () => {
      isMounted = false;
    };
  }, [authState]);

  const categories = useMemo(
    () => productsState.data?.categories ?? [],
    [productsState.data],
  );
  const products = useMemo(
    () => productsState.data?.products ?? [],
    [productsState.data],
  );

  const visibleProducts = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    const min = minPrice === "" ? null : Number(minPrice);
    const max = maxPrice === "" ? null : Number(maxPrice);

    const filtered = products.filter((product) => {
      const matchesCategory =
        selectedCategoryId === "all" || product.product_category_id === selectedCategoryId;
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        (product.description ?? "").toLowerCase().includes(normalizedSearch) ||
        (product.sku ?? "").toLowerCase().includes(normalizedSearch) ||
        (product.category?.name ?? "").toLowerCase().includes(normalizedSearch);
      const matchesAvailability = !onlyAvailable || product.stock_quantity > 0;
      const matchesMin = min === null || Number.isNaN(min) || product.unit_price >= min;
      const matchesMax = max === null || Number.isNaN(max) || product.unit_price <= max;
      return matchesCategory && matchesSearch && matchesAvailability && matchesMin && matchesMax;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "latest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortMode === "price-asc") return a.unit_price - b.unit_price;
      if (sortMode === "price-desc") return b.unit_price - a.unit_price;
      return a.name.localeCompare(b.name, "th");
    });
  }, [maxPrice, minPrice, onlyAvailable, products, searchText, selectedCategoryId, sortMode]);

  async function handleAddToCart(product: ProductWithCategory) {
    if (authState.status !== "ready") return;

    setAddToCartState({ message: null, productId: product.id, status: "adding" });
    const supabase = createClient();
    const { data, error } = await addProductToCart(supabase, authState.user.id, product.id);

    if (error) {
      setAddToCartState({ message: error.message, productId: product.id, status: "error" });
      return;
    }

    setCartState({ error: null, status: "ready", summary: data ?? emptyCartSummary });
    window.dispatchEvent(new Event("cart-updated"));
    setAddToCartState({
      message: `เพิ่ม ${product.name} ลงตะกร้าแล้ว`,
      productId: product.id,
      status: "success",
    });
  }

  function resetFilters() {
    setSelectedCategoryId("all");
    setSearchText("");
    setSortMode("relevant");
    setOnlyAvailable(false);
    setMinPrice("");
    setMaxPrice("");
  }

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#151515]">
      {authState.status === "loading" ? (
        <section className="mx-auto grid min-h-[55vh] max-w-7xl place-items-center px-5 py-12">
          <div className="rounded-xl border border-[#e3e3e3] bg-white px-6 py-4 text-sm text-[#666]">
            กำลังตรวจสอบบัญชี...
          </div>
        </section>
      ) : null}

      {authState.status === "signed-out" ? (
        <section className="mx-auto grid min-h-[55vh] max-w-7xl place-items-center px-5 py-12">
          <div className="w-full max-w-xl rounded-2xl border border-[#e3e3e3] bg-white p-7 text-sm leading-6 shadow-sm">
            <p className="text-lg font-extrabold">กรุณาเข้าสู่ระบบก่อนเลือกซื้อสินค้า</p>
            <p className="mt-2 text-[#666]">ระบบสินค้าใช้บัญชีลูกค้าเพื่อแยกตะกร้าและคำสั่งซื้อของแต่ละคน</p>
            <Link className="mt-5 block rounded-[9px] bg-[#d71920] px-4 py-3 text-center font-extrabold text-white hover:bg-[#b91218]" href="/auth">
              ไปที่หน้าบัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {authState.status === "error" ? (
        <section className="mx-auto grid min-h-[55vh] max-w-7xl place-items-center px-5 py-12">
          <div className="rounded-xl border border-[#efb4b7] bg-white px-6 py-4 text-sm text-[#b31219]">{authState.error}</div>
        </section>
      ) : null}

      {authState.status === "ready" ? (
        <div className="mx-auto max-w-[1380px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-5 border-b border-[#dedede] pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#d71920]">OU CHANG O · PRODUCTS</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-[#151515] sm:text-[28px]">สินค้า</h1>
              </div>
              <Link href="/cart" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-[#d8d8d8] bg-white px-4 text-sm font-extrabold text-[#222] transition hover:border-[#d71920] hover:text-[#d71920]">
                ตะกร้า <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#d71920] px-1.5 text-[11px] text-white">{cartState.summary.itemCount}</span>
              </Link>
            </div>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="rounded-[14px] border border-[#dedede] bg-white p-5 lg:sticky lg:top-5">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-4">
                <h2 className="text-[15px] font-black">ค้นหาและตัวกรอง</h2>
                <button className="text-[11px] font-bold text-[#d71920] hover:underline" onClick={resetFilters} type="button">ล้าง</button>
              </div>

              <div className="pt-5">
                <label className="text-[13px] font-extrabold text-[#222]">ค้นหาสินค้า</label>
                <div className="mt-2 flex h-10 items-center rounded-[8px] border border-[#dcdcdc] bg-white px-3 focus-within:border-[#d71920]">
                  <svg className="mr-2 h-4 w-4 shrink-0 text-[#888]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
                  <input className="w-full bg-transparent text-[12px] outline-none placeholder:text-[#aaa]" onChange={(event) => setSearchText(event.target.value)} placeholder="ชื่อสินค้า หรือ SKU" value={searchText} />
                </div>
              </div>

              <div className="mt-6 border-t border-[#e5e5e5] pt-5">
                <h3 className="text-[13px] font-extrabold">หมวดหมู่สินค้า</h3>
                <div className="mt-4 space-y-3">
                  <SidebarCategory checked={selectedCategoryId === "all"} label="สินค้าทั้งหมด" onChange={() => setSelectedCategoryId("all")} />
                  {categories.map((category) => (
                    <SidebarCategory key={category.id} checked={selectedCategoryId === category.id} label={category.name} onChange={() => setSelectedCategoryId(category.id)} />
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t border-[#e5e5e5] pt-5">
                <h3 className="text-[13px] font-extrabold">สถานะสินค้า</h3>
                <label className="mt-4 flex cursor-pointer items-center gap-3 text-[13px] font-semibold text-[#333]">
                  <input checked={onlyAvailable} className="h-4 w-4 accent-[#d71920]" onChange={(event) => setOnlyAvailable(event.target.checked)} type="checkbox" />
                  มีสินค้าเท่านั้น
                </label>
              </div>

              <div className="mt-6 border-t border-[#e5e5e5] pt-5">
                <h3 className="text-[13px] font-extrabold">ช่วงราคา</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input aria-label="ราคาต่ำสุด" className="h-10 min-w-0 rounded-[8px] border border-[#dcdcdc] px-3 text-[12px] outline-none focus:border-[#d71920]" inputMode="numeric" onChange={(event) => setMinPrice(event.target.value.replace(/[^0-9]/g, ""))} placeholder="ต่ำสุด" value={minPrice} />
                  <input aria-label="ราคาสูงสุด" className="h-10 min-w-0 rounded-[8px] border border-[#dcdcdc] px-3 text-[12px] outline-none focus:border-[#d71920]" inputMode="numeric" onChange={(event) => setMaxPrice(event.target.value.replace(/[^0-9]/g, ""))} placeholder="สูงสุด" value={maxPrice} />
                </div>
              </div>
            </aside>

            <section className="min-w-0">
              <div className="rounded-[14px] border border-[#dedede] bg-white p-3 sm:p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
                    <input className="h-11 w-full rounded-[9px] border border-[#dcdcdc] bg-[#fff] pl-10 pr-4 text-[13px] outline-none focus:border-[#d71920]" onChange={(event) => setSearchText(event.target.value)} placeholder="ค้นหาสินค้า, SKU หรือหมวดสินค้า" value={searchText} />
                  </div>
                  <Link href="/cart" className="hidden h-11 shrink-0 items-center justify-center gap-2 rounded-[9px] bg-[#151515] px-5 text-[13px] font-extrabold text-white transition hover:bg-[#d71920] sm:flex">
                    ตะกร้า <span className="rounded-full bg-white/15 px-2 py-0.5">{cartState.summary.itemCount}</span>
                  </Link>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-3 rounded-[14px] border border-[#dedede] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] font-semibold text-[#555]">แสดง <strong className="text-[#151515]">{visibleProducts.length}</strong> จาก {products.length} รายการ</p>
                <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-[#666]">
                  <span>เรียงโดย</span>
                  <button className={`rounded-[8px] border px-3 py-2 ${sortMode === "relevant" ? "border-[#d71920] bg-[#d71920] text-white" : "border-[#ddd] bg-white text-[#333]"}`} onClick={() => setSortMode("relevant")} type="button">เกี่ยวข้อง</button>
                  <button className={`rounded-[8px] border px-3 py-2 ${sortMode === "latest" ? "border-[#d71920] bg-[#d71920] text-white" : "border-[#ddd] bg-white text-[#333]"}`} onClick={() => setSortMode("latest")} type="button">ล่าสุด</button>
                  <button className={`rounded-[8px] border px-3 py-2 ${sortMode === "price-asc" ? "border-[#d71920] bg-[#d71920] text-white" : "border-[#ddd] bg-white text-[#333]"}`} onClick={() => setSortMode("price-asc")} type="button">ราคาต่ำ → สูง</button>
                  <button className={`rounded-[8px] border px-3 py-2 ${sortMode === "price-desc" ? "border-[#d71920] bg-[#d71920] text-white" : "border-[#ddd] bg-white text-[#333]"}`} onClick={() => setSortMode("price-desc")} type="button">ราคาสูง → ต่ำ</button>
                </div>
              </div>

              {productsState.status === "loading" ? (
                <div className="mt-5 rounded-[14px] border border-[#dedede] bg-white p-8 text-center text-sm text-[#777]">กำลังโหลดสินค้า...</div>
              ) : null}

              {productsState.status === "error" ? (
                <div className="mt-5 rounded-[14px] border border-[#efb4b7] bg-white p-6 text-sm text-[#b31219]">{productsState.error}</div>
              ) : null}

              {productsState.status === "ready" ? (
                visibleProducts.length > 0 ? (
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {visibleProducts.map((product) => (
                      <ProductCard key={product.id} addToCartState={addToCartState} onAddToCart={handleAddToCart} product={product} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-[14px] border border-dashed border-[#ccc] bg-white p-12 text-center">
                    <p className="font-extrabold text-[#333]">ไม่พบสินค้าที่ตรงกับตัวกรอง</p>
                    <button className="mt-4 rounded-[8px] bg-[#d71920] px-4 py-2 text-sm font-extrabold text-white" onClick={resetFilters} type="button">ล้างตัวกรอง</button>
                  </div>
                )
              ) : null}

              {addToCartState.status === "success" ? (
                <div className="fixed bottom-5 right-5 z-50 max-w-[calc(100vw-40px)] rounded-[10px] bg-[#151515] px-4 py-3 text-sm font-bold text-white shadow-xl">
                  <span className="mr-2 text-[#ff3b43]">✓</span>{addToCartState.message}
                </div>
              ) : null}
              {addToCartState.status === "error" ? (
                <div className="fixed bottom-5 right-5 z-50 max-w-[calc(100vw-40px)] rounded-[10px] bg-[#d71920] px-4 py-3 text-sm font-bold text-white shadow-xl">
                  {addToCartState.message}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </main>
  );
}
