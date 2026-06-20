"use client";

import { useCallback, useEffect, useState } from "react";
import { createSalesOrderRecord, loadSalesOrders, saveSalesOrders } from "@/lib/sales-orders";
import type { SalesOrderDraft, SalesOrderLine, SalesOrderRecord } from "@/lib/sales-orders";

export function useSalesOrders() {
  const [orders, setOrders] = useState<SalesOrderRecord[]>(() => loadSalesOrders());

  useEffect(() => {
    setOrders(loadSalesOrders());
  }, []);

  const persist = useCallback((next: SalesOrderRecord[]) => {
    setOrders(next);
    saveSalesOrders(next);
  }, []);

  const createOrder = useCallback(
    (draft: SalesOrderDraft) => {
      const next = [createSalesOrderRecord(draft, orders), ...orders];
      persist(next);
      return next[0];
    },
    [orders, persist],
  );

  const replaceOrders = useCallback(
    (next: SalesOrderRecord[]) => {
      persist(next);
    },
    [persist],
  );

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
    createOrder,
    replaceOrders,
    seedOrderLine,
  };
}
