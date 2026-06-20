"use client";

import { useCallback, useEffect, useState } from "react";
import { createProductRecord, loadProducts, saveProducts } from "@/lib/products";
import type { ProductDraft, ProductRecord } from "@/lib/products";

export function useProducts() {
  const [products, setProducts] = useState<ProductRecord[]>(() => loadProducts());

  useEffect(() => {
    setProducts(loadProducts());
  }, []);

  const persist = useCallback((next: ProductRecord[]) => {
    setProducts(next);
    saveProducts(next);
  }, []);

  const createProduct = useCallback(
    (draft: ProductDraft) => {
      const next = [createProductRecord(draft, products), ...products];
      persist(next);
      return next[0];
    },
    [products, persist],
  );

  const replaceProducts = useCallback(
    (next: ProductRecord[]) => {
      persist(next);
    },
    [persist],
  );

  return {
    products,
    createProduct,
    replaceProducts,
  };
}
