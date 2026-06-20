export const AUDIT_LOG_STORAGE_KEY = "oodo-erp.audit-logs.v1";

export type AuditAction =
  | "Created"
  | "Updated"
  | "Deleted"
  | "Viewed"
  | "Opened"
  | "Closed"
  | "Exported"
  | "Signed In"
  | "Signed Up"
  | "Signed Out";

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  user: string;
  module: string;
  recordType: string;
  recordId: string;
  action: AuditAction;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  details?: string;
};

export type AuditLogInput = Omit<AuditLogEntry, "id" | "timestamp"> & {
  id?: string;
  timestamp?: string;
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `audit_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function toTimestamp(value: string | Date | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  return value instanceof Date ? value.toISOString() : value;
}

export function createAuditLogEntry(input: AuditLogInput): AuditLogEntry {
  return {
    id: input.id ?? createId(),
    timestamp: toTimestamp(input.timestamp),
    user: input.user.trim(),
    module: input.module.trim(),
    recordType: input.recordType.trim(),
    recordId: input.recordId.trim(),
    action: input.action,
    fieldChanged: input.fieldChanged.trim(),
    oldValue: input.oldValue.trim(),
    newValue: input.newValue.trim(),
    details: input.details?.trim() || undefined,
  };
}

export function sortAuditLogs(entries: AuditLogEntry[]) {
  return [...entries].sort((left, right) => {
    const timeDiff = new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();

    if (timeDiff !== 0) {
      return timeDiff;
    }

    return right.id.localeCompare(left.id);
  });
}

export function mergeAuditLogs(...groups: AuditLogEntry[][]) {
  const merged = new Map<string, AuditLogEntry>();

  for (const group of groups) {
    for (const entry of group) {
      merged.set(entry.id, entry);
    }
  }

  return sortAuditLogs(Array.from(merged.values()));
}

export function loadAuditLogs(): AuditLogEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(AUDIT_LOG_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as AuditLogEntry[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortAuditLogs(
      parsed.filter((entry): entry is AuditLogEntry => {
        return Boolean(
          entry &&
            typeof entry.id === "string" &&
            typeof entry.timestamp === "string" &&
            typeof entry.user === "string" &&
            typeof entry.module === "string" &&
            typeof entry.recordType === "string" &&
            typeof entry.recordId === "string" &&
            typeof entry.action === "string" &&
            typeof entry.fieldChanged === "string" &&
            typeof entry.oldValue === "string" &&
            typeof entry.newValue === "string",
        );
      }),
    );
  } catch {
    return [];
  }
}

export function saveAuditLogs(entries: AuditLogEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(sortAuditLogs(entries)));
}

export function clearAuditLogsStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUDIT_LOG_STORAGE_KEY);
}

export function createLocalDateKey(timestamp: string) {
  const date = new Date(timestamp);
  const year = date.getFullYear().toString();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatAuditTimestamp(timestamp: string) {
  const date = new Date(timestamp);

  return {
    date: date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

