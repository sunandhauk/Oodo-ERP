"use client";

import { useCallback, useEffect, useState } from "react";
import { createManufacturingOrderRecord, loadManufacturingOrders, saveManufacturingOrders } from "@/lib/manufacturing-orders";
import type { ManufacturingComponentLine, ManufacturingOrderDraft, ManufacturingOrderRecord, ManufacturingWorkOrderLine } from "@/lib/manufacturing-orders";

export function useManufacturingOrders() {
  const [orders, setOrders] = useState<ManufacturingOrderRecord[]>(() => loadManufacturingOrders());

  useEffect(() => {
    setOrders(loadManufacturingOrders());
  }, []);

  const persist = useCallback((next: ManufacturingOrderRecord[]) => {
    setOrders(next);
    saveManufacturingOrders(next);
  }, []);

  const createOrder = useCallback(
    (draft: ManufacturingOrderDraft) => {
      const next = [createManufacturingOrderRecord(draft, orders), ...orders];
      persist(next);
      return next[0];
    },
    [orders, persist],
  );

  const replaceOrders = useCallback(
    (next: ManufacturingOrderRecord[]) => {
      persist(next);
    },
    [persist],
  );

  const seedComponentLine = useCallback(
    (): ManufacturingComponentLine => ({
      component: "",
      availability: "Available",
      toConsumeUnits: 1,
      consumeUnits: 0,
      unitCost: 0,
    }),
    [],
  );

  const seedWorkOrderLine = useCallback(
    (): ManufacturingWorkOrderLine => ({
      operation: "",
      assignee: "",
      plannedHours: 1,
      status: "Pending",
    }),
    [],
  );

  return {
    orders,
    createOrder,
    replaceOrders,
    seedComponentLine,
    seedWorkOrderLine,
  };
}
