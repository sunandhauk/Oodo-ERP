"use client";

import { useCallback, useEffect, useState } from "react";
import type { BomComponentLine, BomDraft, BomRecord, BomWorkOrderLine } from "@/lib/bom";

export function useBoms() {
  const [boms, setBoms] = useState<BomRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadBoms = useCallback(async () => {
    const response = await fetch("/api/bills-of-materials", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { status?: string; data?: BomRecord[]; error?: unknown } | null;
    if (response.ok && payload?.status === "success" && Array.isArray(payload.data)) {
      setBoms(payload.data);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await loadBoms();
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
  }, [loadBoms]);

  const createBom = useCallback(async (draft: BomDraft) => {
    const response = await fetch("/api/bills-of-materials", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draft),
    });
    const payload = (await response.json().catch(() => null)) as { status?: string; data?: BomRecord; error?: { message?: string } | string } | null;
    const created = payload?.data;
    if (!response.ok || payload?.status !== "success" || !created) {
      throw new Error(typeof payload?.error === "string" ? payload.error : payload?.error?.message || "Unable to create bill of materials.");
    }

    setBoms((current) => [created, ...current]);
    return created;
  }, []);

  const replaceBoms = useCallback((next: BomRecord[]) => {
    setBoms(next);
  }, []);

  const seedComponentLine = useCallback(
    (): BomComponentLine => ({
      component: "",
      availability: "Available",
      toConsumeUnits: 1,
      consumeUnits: 0,
    }),
    [],
  );

  const seedWorkOrderLine = useCallback(
    (): BomWorkOrderLine => ({
      operation: "",
      assignee: "",
      plannedHours: 1,
      status: "Pending",
    }),
    [],
  );

  return {
    boms,
    isLoading,
    createBom,
    replaceBoms,
    refreshBoms: loadBoms,
    seedComponentLine,
    seedWorkOrderLine,
  };
}
