"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuditLog } from "@/components/audit-log-provider";
import { ChevronDownIcon, NotificationsSharpIcon } from "@/components/icons";
import { formatAuditTimestamp } from "@/lib/audit-log";
import type { AuditLogEntry } from "@/lib/audit-log";

const COMPLETED_NOTIFICATIONS_STORAGE_KEY = "oodo-erp.notification-completed.v1";

const NOTIFICATION_MODULES_TO_SKIP = new Set(["Navigation", "Notifications"]);
const NOTIFICATION_ACTIONS = new Set([
  "Created",
  "Updated",
  "Deleted",
  "Exported",
  "Opened",
  "Closed",
  "Signed In",
  "Signed Up",
  "Signed Out",
]);

function isRelevantNotification(entry: AuditLogEntry) {
  return !NOTIFICATION_MODULES_TO_SKIP.has(entry.module) && NOTIFICATION_ACTIONS.has(entry.action);
}

function buildNotificationTitle(entry: AuditLogEntry) {
  return `${entry.action} ${entry.recordType}`;
}

function buildNotificationBody(entry: AuditLogEntry) {
  if (entry.details) {
    return entry.details;
  }

  if (entry.fieldChanged) {
    return `${entry.recordId} • ${entry.fieldChanged}: ${entry.oldValue || "-"} → ${entry.newValue || "-"}`;
  }

  return `${entry.module} • ${entry.recordId}`;
}

function buildNotificationAccent(action: string) {
  if (action === "Deleted") {
    return "bg-rose-50 text-rose-600 ring-rose-100";
  }

  if (action === "Created") {
    return "bg-emerald-50 text-emerald-600 ring-emerald-100";
  }

  if (action === "Exported") {
    return "bg-cyan-50 text-cyan-600 ring-cyan-100";
  }

  if (action === "Signed In" || action === "Signed Up" || action === "Signed Out") {
    return "bg-violet-50 text-violet-600 ring-violet-100";
  }

  return "bg-blue-50 text-blue-600 ring-blue-100";
}

export function NotificationCenter({ actorName }: { actorName: string }) {
  const router = useRouter();
  const { entries, appendAuditLog } = useAuditLog();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(COMPLETED_NOTIFICATIONS_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        setCompletedIds(parsed.filter((value): value is string => typeof value === "string"));
      }
    } catch {
      setCompletedIds([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(COMPLETED_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(completedIds));
  }, [completedIds]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!open) {
        return;
      }

      const target = event.target;
      if (
        target instanceof Node &&
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    function updateMenuPosition() {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 12,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  const notifications = useMemo(() => {
    return entries
      .filter(isRelevantNotification)
      .filter((entry) => !completedIds.includes(entry.id))
      .slice(0, 8)
      .map((entry) => {
        const timestamp = formatAuditTimestamp(entry.timestamp);
        return {
          id: entry.id,
          entry,
          title: buildNotificationTitle(entry),
          body: buildNotificationBody(entry),
          time: `${timestamp.date} • ${timestamp.time}`,
        };
      });
  }, [completedIds, entries]);

  function markCompleted(entry: AuditLogEntry) {
    setCompletedIds((current) => (current.includes(entry.id) ? current : [...current, entry.id]));

    appendAuditLog({
      user: actorName,
      module: "Notifications",
      recordType: "Alert",
      recordId: entry.id,
      action: "Closed",
      fieldChanged: "Status",
      oldValue: "Open",
      newValue: "Completed",
      details: `Marked notification completed for ${entry.module} ${entry.recordId}`,
    });

    if (notifications.length <= 1) {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-11 w-11 items-center justify-center rounded-[0.25rem] border border-slate-200 bg-white text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
        aria-label={`Notifications ${notifications.length > 0 ? `(${notifications.length} new)` : ""}`}
        aria-expanded={open}
      >
        <NotificationsSharpIcon className="h-5 w-5 text-slate-700" />
        {notifications.length > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[0.68rem] font-bold leading-none text-white shadow-sm ring-2 ring-white">
            {notifications.length}
          </span>
        ) : null}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[9998] bg-transparent"
                aria-hidden="true"
                onClick={() => setOpen(false)}
              />
              <div
                ref={menuRef}
                className="fixed z-[9999] w-[min(92vw,420px)] overflow-hidden rounded-[0.25rem] border border-slate-200 bg-white shadow-[0_30px_70px_rgba(15,23,42,0.22)]"
                style={{
                  top: menuPosition.top,
                  right: menuPosition.right,
                }}
              >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-extrabold tracking-[-0.03em] text-slate-900">Notifications</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{notifications.length} pending update{notifications.length === 1 ? "" : "s"}</p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/audit-logs")}
              className="rounded-[0.25rem] border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View Logs
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {notifications.length > 0 ? (
              <div className="space-y-2 p-3">
                {notifications.map(({ id, entry, title, body, time }) => (
                  <article key={id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${buildNotificationAccent(entry.action)}`}>
                        <span className="text-[0.72rem] font-extrabold uppercase tracking-[0.14em]">{entry.action.slice(0, 2)}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{title}</p>
                            <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                              {entry.module} • {entry.recordId}
                            </p>
                          </div>
                          <span className="whitespace-nowrap text-[0.72rem] font-semibold text-slate-400">{time}</span>
                        </div>

                        <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[0.72rem] font-semibold text-slate-500 shadow-sm">
                            <ChevronDownIcon className="h-3.5 w-3.5 rotate-[-90deg] text-slate-400" />
                            {entry.action}
                          </span>

                          <button
                            type="button"
                            onClick={() => markCompleted(entry)}
                            className="inline-flex items-center gap-1.5 rounded-[0.25rem] bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                          >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="m20 6-11 11-5-5" />
                            </svg>
                            Mark as completed
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="px-4 py-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <NotificationsSharpIcon className="h-6 w-6 text-slate-400" />
                </div>
                <p className="mt-4 text-sm font-bold text-slate-900">All caught up</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">New business updates will appear here automatically.</p>
              </div>
            )}
          </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

