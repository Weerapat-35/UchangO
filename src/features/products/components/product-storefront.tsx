"use client";

/* eslint-disable @next/next/no-img-element */

import { PageHeader } from "@/components/page-header";
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
import "./product-storefront.css";

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

const emptyCartSummary: CartSummary = {
  cart: null,
  itemCount: 0,
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});
const productImagePlaceholder = "/product-placeholder.svg";

function handleProductImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;

  if (image.src.endsWith(productImagePlaceholder)) {
    return;
  }

  image.src = productImagePlaceholder;
  image.alt = "ภาพสินค้าเริ่มต้น";
}

type SortKey = "default" | "price-asc" | "price-desc" | "name";

function CartIcon() {
  return (
    <svg aria-hidden="true" className="ps-icon" viewBox="0 0 24 24">
      <path d="M3 4h2.2l1.6 11h10.6L19.5 7.5H6.1" />
      <circle cx="9.5" cy="19" r="1.4" />
      <circle cx="16.5" cy="19" r="1.4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="ps-icon" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" className="ps-icon" viewBox="0 0 24 24">
      <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />
    </svg>
  );
}

function getStockLabel(product: ProductWithCategory) {
  if (product.stock_quantity <= 0) {
    return "สินค้าหมด";
  }

  if (product.stock_quantity <= 2) {
    return `เหลือน้อย • ${product.stock_quantity} ชิ้น`;
  }

  return `มีสินค้า • ${product.stock_quantity} ชิ้น`;
}

function getStockTone(product: ProductWithCategory) {
  if (product.stock_quantity <= 0) {
    return "is-out";
  }

  if (product.stock_quantity <= 2) {
    return "is-low";
  }

  return "is-ok";
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
  const isLowStock = !isOutOfStock && product.stock_quantity <= 2;

  return (
    <article className={`ps-card${isOutOfStock ? " is-sold-out" : ""}`}>
      <div className="ps-card__media">
        <img
          alt={`รูปสินค้า ${product.name}`}
          loading="lazy"
          onError={handleProductImageError}
          src={product.image_url || productImagePlaceholder}
        />
        {isLowStock ? <span className="ps-card__badge">เหลือน้อย</span> : null}
        {isOutOfStock ? (
          <span className="ps-card__badge is-dark">สินค้าหมด</span>
        ) : null}
      </div>

      <div className="ps-card__body">
        <p className="ps-card__category">
          {product.category?.name ?? "ไม่มีหมวดสินค้า"}
        </p>
        <h3 className="ps-card__name" title={product.name}>
          {product.name}
        </h3>
        <p className={`ps-card__stock ${getStockTone(product)}`}>
          <span aria-hidden="true" className="ps-dot" />
          {getStockLabel(product)}
        </p>
        <p className="ps-card__price">{currencyFormatter.format(product.unit_price)}</p>
        <button
          className="ps-btn ps-btn--block"
          disabled={isOutOfStock || isAdding}
          onClick={() => onAddToCart(product)}
          type="button"
        >
          <CartIcon />
          {isOutOfStock ? "สินค้าหมด" : isAdding ? "กำลังเพิ่ม..." : "เพิ่มใส่ตะกร้า"}
        </button>
      </div>
    </article>
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
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [minPriceDraft, setMinPriceDraft] = useState("");
  const [maxPriceDraft, setMaxPriceDraft] = useState("");
  const [appliedPrice, setAppliedPrice] = useState<{ min: number | null; max: number | null }>({
    max: null,
    min: null,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
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

    async function loadProducts() {
      if (authState.status !== "ready") {
        setProductsState({
          data: null,
          error: null,
          status: "idle",
        });
        return;
      }

      setProductsState({
        data: null,
        error: null,
        status: "loading",
      });

      const supabase = createClient();
      const { data, error } = await getStorefrontProducts(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setProductsState({
          data: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setProductsState({
        data,
        error: null,
        status: "ready",
      });
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [authState.status]);

  useEffect(() => {
    let isMounted = true;

    async function loadCartSummary() {
      if (authState.status !== "ready") {
        setCartState({
          error: null,
          status: "idle",
          summary: emptyCartSummary,
        });
        return;
      }

      setCartState((currentState) => ({
        error: null,
        status: "loading",
        summary: currentState.summary,
      }));

      const supabase = createClient();
      const { data, error } = await getCartSummary(supabase, authState.user.id);

      if (!isMounted) {
        return;
      }

      if (error) {
        setCartState((currentState) => ({
          error: error.message,
          status: "error",
          summary: currentState.summary,
        }));
        return;
      }

      setCartState({
        error: null,
        status: "ready",
        summary: data ?? emptyCartSummary,
      });
    }

    loadCartSummary();

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
    const normalizedSearchText = searchText.trim().toLowerCase();

    const filtered = products.filter((product) => {
      const matchesCategory =
        selectedCategoryIds.length === 0 ||
        selectedCategoryIds.includes(product.product_category_id);
      const matchesPrice =
        (appliedPrice.min === null || product.unit_price >= appliedPrice.min) &&
        (appliedPrice.max === null || product.unit_price <= appliedPrice.max);
      const matchesSearch =
        normalizedSearchText.length === 0 ||
        product.name.toLowerCase().includes(normalizedSearchText) ||
        (product.description ?? "").toLowerCase().includes(normalizedSearchText) ||
        (product.sku ?? "").toLowerCase().includes(normalizedSearchText) ||
        (product.category?.name ?? "").toLowerCase().includes(normalizedSearchText);

      return matchesCategory && matchesPrice && matchesSearch;
    });

    if (sortKey === "price-asc") {
      return [...filtered].sort((a, b) => a.unit_price - b.unit_price);
    }

    if (sortKey === "price-desc") {
      return [...filtered].sort((a, b) => b.unit_price - a.unit_price);
    }

    if (sortKey === "name") {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name, "th"));
    }

    return filtered;
  }, [appliedPrice, products, searchText, selectedCategoryIds, sortKey]);

  const hasActiveFilters =
    selectedCategoryIds.length > 0 ||
    searchText.trim().length > 0 ||
    appliedPrice.min !== null ||
    appliedPrice.max !== null;

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  function applyPriceFilter() {
    const min = minPriceDraft.trim() === "" ? null : Number(minPriceDraft);
    const max = maxPriceDraft.trim() === "" ? null : Number(maxPriceDraft);

    setAppliedPrice({
      max: max !== null && Number.isFinite(max) ? max : null,
      min: min !== null && Number.isFinite(min) ? min : null,
    });
    setFiltersOpen(false);
  }

  function resetFilters() {
    setSelectedCategoryIds([]);
    setSearchText("");
    setMinPriceDraft("");
    setMaxPriceDraft("");
    setAppliedPrice({ max: null, min: null });
    setSortKey("default");
  }

  async function handleAddToCart(product: ProductWithCategory) {
    if (authState.status !== "ready") {
      return;
    }

    setAddToCartState({
      message: null,
      productId: product.id,
      status: "adding",
    });

    const supabase = createClient();
    const { data, error } = await addProductToCart(
      supabase,
      authState.user.id,
      product.id,
    );

    if (error) {
      setAddToCartState({
        message: error.message,
        productId: product.id,
        status: "error",
      });
      return;
    }

    setCartState({
      error: null,
      status: "ready",
      summary: data ?? emptyCartSummary,
    });
    window.dispatchEvent(new Event("cart-updated"));
    setAddToCartState({
      message: `เพิ่ม ${product.name} ลงตะกร้าแล้ว`,
      productId: product.id,
      status: "success",
    });
  }

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const product of products) {
      counts.set(
        product.product_category_id,
        (counts.get(product.product_category_id) ?? 0) + 1,
      );
    }

    return counts;
  }, [products]);

  return (
    <main className="ps-page">
      <PageHeader
        crumbs={[{ label: "สินค้า" }]}
        description="อะไหล่และสินค้าคุณภาพสำหรับรถของคุณ"
        title="สินค้า"
      />

      {authState.status === "loading" ? (
        <section className="ps-state">กำลังตรวจสอบบัญชี...</section>
      ) : null}

      {authState.status === "signed-out" ? (
        <section className="ps-state is-notice">
          <p className="ps-state__title">ต้องเข้าสู่ระบบก่อนดูหน้าร้าน</p>
          <p>
            ตอนนี้ระบบสินค้าใช้ข้อมูลลูกค้าจากบัญชีของคุณ เพื่อแยกตะกร้าและคำสั่งซื้อให้ถูกคน
          </p>
          <Link className="ps-btn" href="/auth">
            ไปที่หน้าบัญชี
          </Link>
        </section>
      ) : null}

      {authState.status === "error" ? (
        <section className="ps-state is-error">{authState.error}</section>
      ) : null}

      {authState.status === "ready" ? (
        <section className="ps-layout">
          <aside className="ps-filter">
            <button
              aria-expanded={filtersOpen}
              className="ps-filter__toggle"
              onClick={() => setFiltersOpen((open) => !open)}
              type="button"
            >
              <FilterIcon />
              ค้นหาและกรอง
              {hasActiveFilters ? <span className="ps-filter__pip" /> : null}
            </button>

            <div className={`ps-filter__panel${filtersOpen ? " is-open" : ""}`}>
              <h2 className="ps-filter__title">
                <FilterIcon />
                ค้นหาและกรอง
              </h2>

              <fieldset className="ps-filter__group">
                <legend>หมวดหมู่สินค้า</legend>
                {categories.length === 0 ? (
                  <p className="ps-muted">ยังไม่มีหมวดสินค้า</p>
                ) : (
                  categories.map((category) => (
                    <label className="ps-check" key={category.id}>
                      <input
                        checked={selectedCategoryIds.includes(category.id)}
                        onChange={() => toggleCategory(category.id)}
                        type="checkbox"
                      />
                      <span>{category.name}</span>
                      <em>{categoryCounts.get(category.id) ?? 0}</em>
                    </label>
                  ))
                )}
              </fieldset>

              <fieldset className="ps-filter__group">
                <legend>ช่วงราคา (บาท)</legend>
                <div className="ps-price">
                  <input
                    aria-label="ราคาต่ำสุด"
                    className="ps-input"
                    inputMode="numeric"
                    min={0}
                    onChange={(event) => setMinPriceDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applyPriceFilter();
                    }}
                    placeholder="ต่ำสุด"
                    type="number"
                    value={minPriceDraft}
                  />
                  <span aria-hidden="true">–</span>
                  <input
                    aria-label="ราคาสูงสุด"
                    className="ps-input"
                    inputMode="numeric"
                    min={0}
                    onChange={(event) => setMaxPriceDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applyPriceFilter();
                    }}
                    placeholder="สูงสุด"
                    type="number"
                    value={maxPriceDraft}
                  />
                </div>
              </fieldset>

              <button className="ps-btn ps-btn--block ps-btn--lg" onClick={applyPriceFilter} type="button">
                <FilterIcon />
                ค้นหาสินค้า
              </button>
              {hasActiveFilters ? (
                <button className="ps-link" onClick={resetFilters} type="button">
                  ล้างตัวกรองทั้งหมด
                </button>
              ) : null}
            </div>
          </aside>

          <div className="ps-main">
            <div className="ps-toolbar">
              <label className="ps-search">
                <SearchIcon />
                <input
                  aria-label="ค้นหาสินค้า"
                  className="ps-input"
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="ค้นหาสินค้า, SKU หรือหมวดหมู่สินค้า"
                  value={searchText}
                />
              </label>
              <select
                aria-label="เรียงลำดับ"
                className="ps-input ps-sort"
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                value={sortKey}
              >
                <option value="default">เรียงลำดับ</option>
                <option value="price-asc">ราคาต่ำ → สูง</option>
                <option value="price-desc">ราคาสูง → ต่ำ</option>
                <option value="name">ชื่อ ก → ฮ</option>
              </select>
            </div>

            <div className="ps-chips" role="group" aria-label="หมวดหมู่สินค้า">
              <button
                aria-pressed={selectedCategoryIds.length === 0}
                className="ps-chip"
                onClick={() => setSelectedCategoryIds([])}
                type="button"
              >
                ทั้งหมด
              </button>
              {categories.map((category) => (
                <button
                  aria-pressed={
                    selectedCategoryIds.length === 1 &&
                    selectedCategoryIds[0] === category.id
                  }
                  className="ps-chip"
                  key={category.id}
                  onClick={() => setSelectedCategoryIds([category.id])}
                  type="button"
                >
                  {category.name}
                </button>
              ))}
            </div>

            {addToCartState.status === "success" ? (
              <div className="ps-toast is-success" role="status">
                <span>{addToCartState.message}</span>
                <Link href="/cart">ดูตะกร้า ({cartState.summary.itemCount})</Link>
              </div>
            ) : null}
            {addToCartState.status === "error" ? (
              <div className="ps-toast is-error" role="alert">
                {addToCartState.message}
              </div>
            ) : null}
            {cartState.status === "error" ? (
              <div className="ps-toast is-error" role="alert">
                {cartState.error}
              </div>
            ) : null}

            {productsState.status === "loading" ? (
              <div aria-busy="true" className="ps-grid">
                {Array.from({ length: 10 }, (_, index) => (
                  <div className="ps-card ps-skeleton" key={index}>
                    <div className="ps-card__media" />
                    <div className="ps-card__body">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {productsState.status === "error" ? (
              <div className="ps-state is-error">{productsState.error}</div>
            ) : null}

            {productsState.status === "ready" ? (
              visibleProducts.length > 0 ? (
                <>
                  <p className="ps-count">แสดง {visibleProducts.length} จาก {products.length} รายการ</p>
                  <div className="ps-grid">
                    {visibleProducts.map((product) => (
                      <ProductCard
                        addToCartState={addToCartState}
                        key={product.id}
                        onAddToCart={handleAddToCart}
                        product={product}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="ps-empty">
                  <p>ไม่พบสินค้าตามตัวกรองนี้</p>
                  <button className="ps-btn" onClick={resetFilters} type="button">
                    ล้างตัวกรอง
                  </button>
                </div>
              )
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
