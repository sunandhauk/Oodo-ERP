"use client";

import { useCallback, useEffect, useState } from "react";
import type { SalesOrderDraft, SalesOrderLine, SalesOrderRecord } from "@/lib/sales-orders";

export function useSalesOrders() {
  const [orders, setOrders] = useState<SalesOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    const response = await fetch("/api/sales-orders", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { status?: string; data?: SalesOrderRecord[]; error?: unknown } | null;
    if (response.ok && payload?.status === "success" && Array.isArray(payload.data)) {
      setOrders(payload.data);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await loadOrders();
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
  }, [loadOrders]);

  const createOrder = useCallback(async (draft: SalesOrderDraft) => {
    const response = await fetch("/api/sales-orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draft),
    });
    const payload = (await response.json().catch(() => null)) as { status?: string; data?: SalesOrderRecord; error?: { message?: string } | string } | null;
    const created = payload?.data;
    if (!response.ok || payload?.status !== "success" || !created) {
      throw new Error(typeof payload?.error === "string" ? payload.error : payload?.error?.message || "Unable to create sales order.");
    }

    setOrders((current) => [created, ...current]);
    return created;
  }, []);

  const replaceOrders = useCallback((next: SalesOrderRecord[]) => {
    setOrders(next);
  }, []);

  const seedOrderLine = useCallback(
    (): SalesOrderLine => ({
      product: "",
      availability: "In Stock",
      orderedQuantity: 1,
      deliveredQuantity: 0,
      units: "Nos",
      unitPrice: 0,
    }),
    [],
  );

  return {
    orders,
    isLoading,
    createOrder,
    replaceOrders,
    refreshOrders: loadOrders,
    seedOrderLine,
  };
}
