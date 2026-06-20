"use client";

import { useCallback, useEffect, useState } from "react";
import { createBomRecord, loadBoms, saveBoms } from "@/lib/bom";
import type { BomComponentLine, BomDraft, BomRecord, BomWorkOrderLine } from "@/lib/bom";

export function useBoms() {
  const [boms, setBoms] = useState<BomRecord[]>(() => loadBoms());

  useEffect(() => {
    setBoms(loadBoms());
  }, []);

  const persist = useCallback((next: BomRecord[]) => {
    setBoms(next);
    saveBoms(next);
  }, []);

  const createBom = useCallback(
    (draft: BomDraft) => {
      const next = [createBomRecord(draft, boms), ...boms];
      persist(next);
      return next[0];
    },
    [boms, persist],
  );

  const replaceBoms = useCallback(
    (next: BomRecord[]) => {
      persist(next);
    },
    [persist],
  );

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
    createBom,
    replaceBoms,
    seedComponentLine,
    seedWorkOrderLine,
  };
}
