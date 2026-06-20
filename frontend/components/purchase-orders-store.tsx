"use client";

import { useCallback, useEffect, useState } from "react";
import { createPurchaseOrderRecord, loadPurchaseOrders, savePurchaseOrders } from "@/lib/purchase-orders";
import type { PurchaseOrderDraft, PurchaseOrderLine, PurchaseOrderRecord } from "@/lib/purchase-orders";

export function usePurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>(() => loadPurchaseOrders());

  useEffect(() => {
    setOrders(loadPurchaseOrders());
  }, []);

  const persist = useCallback((next: PurchaseOrderRecord[]) => {
    setOrders(next);
    savePurchaseOrders(next);
  }, []);

  const createOrder = useCallback(
    (draft: PurchaseOrderDraft) => {
      const next = [createPurchaseOrderRecord(draft, orders), ...orders];
      persist(next);
      return next[0];
    },
    [orders, persist],
  );

  const replaceOrders = useCallback(
    (next: PurchaseOrderRecord[]) => {
      persist(next);
    },
    [persist],
  );

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
    createOrder,
    replaceOrders,
    seedOrderLine,
  };
}
