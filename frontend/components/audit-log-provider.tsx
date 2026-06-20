"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  clearAuditLogsStorage,
  createAuditLogEntry,
  loadAuditLogs,
  mergeAuditLogs,
  saveAuditLogs,
} from "@/lib/audit-log";
import type { AuditLogEntry, AuditLogInput } from "@/lib/audit-log";

type AuditLogContextValue = {
  entries: AuditLogEntry[];
  appendAuditLog: (input: AuditLogInput) => AuditLogEntry;
  clearAuditLogs: () => void;
};

const AuditLogContext = createContext<AuditLogContextValue | null>(null);

export function AuditLogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const stored = loadAuditLogs();
    setEntries((current) => mergeAuditLogs(stored, current));
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    saveAuditLogs(entries);
  }, [entries]);

  const appendAuditLog = useCallback((input: AuditLogInput) => {
    const entry = createAuditLogEntry(input);

    setEntries((current) => {
      const next = mergeAuditLogs([entry], current);
      saveAuditLogs(next);
      return next;
    });

    return entry;
  }, []);

  const clearAuditLogs = useCallback(() => {
    setEntries([]);
    clearAuditLogsStorage();
  }, []);

  return (
    <AuditLogContext.Provider
      value={{
        entries,
        appendAuditLog,
        clearAuditLogs,
      }}
    >
      {children}
    </AuditLogContext.Provider>
  );
}

export function useAuditLog() {
  const context = useContext(AuditLogContext);

  if (!context) {
    throw new Error("useAuditLog must be used within an AuditLogProvider.");
  }

  return context;
}

