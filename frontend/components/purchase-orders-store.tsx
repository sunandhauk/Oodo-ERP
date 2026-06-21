"use client";

import { useCallback, useEffect, useState } from "react";
import type { PurchaseOrderDraft, PurchaseOrderLine, PurchaseOrderRecord } from "@/lib/purchase-orders";

export function usePurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    const response = await fetch("/api/purchase-orders", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { status?: string; data?: PurchaseOrderRecord[]; error?: unknown } | null;
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

  const createOrder = useCallback(async (draft: PurchaseOrderDraft) => {
    const response = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draft),
    });
    const payload = (await response.json().catch(() => null)) as { status?: string; data?: PurchaseOrderRecord; error?: { message?: string } | string } | null;
    const created = payload?.data;
    if (!response.ok || payload?.status !== "success" || !created) {
      throw new Error(typeof payload?.error === "string" ? payload.error : payload?.error?.message || "Unable to create purchase order.");
    }

    setOrders((current) => [created, ...current]);
    return created;
  }, []);

  const replaceOrders = useCallback((next: PurchaseOrderRecord[]) => {
    setOrders(next);
  }, []);

  const seedOrderLine = useCallback(
    (): PurchaseOrderLine => ({
      product: "",
      orderedQuantity: 1,
      receivedQuantity: 0,
      units: "Nos",
      unitCost: 0,
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
