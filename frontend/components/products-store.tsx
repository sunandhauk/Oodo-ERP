"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ProductDraft, ProductRecord } from "@/lib/products";

type ProductsContextValue = {
  products: ProductRecord[];
  isLoading: boolean;
  createProduct: (draft: ProductDraft) => Promise<ProductRecord>;
  replaceProducts: (next: ProductRecord[]) => void;
  refreshProducts: () => Promise<void>;
};

const ProductsContext = createContext<ProductsContextValue | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    const response = await fetch("/api/products", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { status?: string; data?: ProductRecord[]; error?: unknown } | null;
    if (response.ok && payload?.status === "success" && Array.isArray(payload.data)) {
      setProducts(payload.data);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await loadProducts();
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadProducts]);

  const createProduct = useCallback(async (draft: ProductDraft) => {
    const response = await fetch("/api/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draft),
    });
    const payload = (await response.json().catch(() => null)) as { status?: string; data?: ProductRecord; error?: { message?: string } | string } | null;
    const created = payload?.data;
    if (!response.ok || payload?.status !== "success" || !created) {
      throw new Error(typeof payload?.error === "string" ? payload.error : payload?.error?.message || "Unable to create product.");
    }

    setProducts((current) => [created, ...current.filter((item) => item.id !== created.id)]);
    return created;
  }, []);

  const replaceProducts = useCallback((next: ProductRecord[]) => {
    setProducts(next);
  }, []);

  const value = useMemo(
    () => ({
      products,
      isLoading,
      createProduct,
      replaceProducts,
      refreshProducts: loadProducts,
    }),
    [createProduct, isLoading, loadProducts, products, replaceProducts],
  );

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const context = useContext(ProductsContext);

  if (!context) {
    throw new Error("useProducts must be used within a ProductsProvider.");
  }

  return context;
}
