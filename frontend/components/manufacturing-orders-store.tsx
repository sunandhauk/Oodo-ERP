"use client";

import { useCallback, useEffect, useState } from "react";
import type { ManufacturingComponentLine, ManufacturingOrderDraft, ManufacturingOrderRecord, ManufacturingWorkOrderLine } from "@/lib/manufacturing-orders";

export function useManufacturingOrders() {
  const [orders, setOrders] = useState<ManufacturingOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    const response = await fetch("/api/manufacturing-orders", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { status?: string; data?: ManufacturingOrderRecord[]; error?: unknown } | null;
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

  const createOrder = useCallback(async (draft: ManufacturingOrderDraft) => {
    const response = await fetch("/api/manufacturing-orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draft),
    });
    const payload = (await response.json().catch(() => null)) as { status?: string; data?: ManufacturingOrderRecord; error?: { message?: string } | string } | null;
    const created = payload?.data;
    if (!response.ok || payload?.status !== "success" || !created) {
      throw new Error(typeof payload?.error === "string" ? payload.error : payload?.error?.message || "Unable to create manufacturing order.");
    }

    setOrders((current) => [created, ...current]);
    return created;
  }, []);

  const replaceOrders = useCallback((next: ManufacturingOrderRecord[]) => {
    setOrders(next);
  }, []);

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
      realHours: 0,
      status: "Pending",
    }),
    [],
  );

  return {
    orders,
    isLoading,
    createOrder,
    replaceOrders,
    refreshOrders: loadOrders,
    seedComponentLine,
    seedWorkOrderLine,
  };
}
