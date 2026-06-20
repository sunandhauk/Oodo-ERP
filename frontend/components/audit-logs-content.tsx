"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarIcon,
  ChevronDownIcon,
  DashboardIcon,
  MenuDotsIcon,
  SearchIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/icons";
import { useAuditLog } from "@/components/audit-log-provider";
import { formatAuditTimestamp, createLocalDateKey } from "@/lib/audit-log";

type FilterState = {
  query: string;
  user: string;
  module: string;
  recordType: string;
  action: string;
  fromDate: string;
  toDate: string;
};

const actionBadgeClass: Record<string, string> = {
  Created: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Updated: "bg-brand-50 text-brand-700 ring-brand-100",
  Deleted: "bg-rose-50 text-rose-700 ring-rose-100",
  Viewed: "bg-slate-100 text-slate-700 ring-slate-200",
  Opened: "bg-violet-50 text-violet-700 ring-violet-100",
  Closed: "bg-amber-50 text-amber-700 ring-amber-100",
  Exported: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  "Signed In": "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "Signed Up": "bg-teal-50 text-teal-700 ring-teal-100",
  "Signed Out": "bg-slate-100 text-slate-700 ring-slate-200",
};

function InfoCard({
  title,
  count,
  caption,
  accent,
  icon,
}: {
  title: string;
  count: number;
  caption: string;
  accent: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.82rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
          <div className="mt-2 text-3xl font-extrabold tracking-[-0.05em] text-slate-900">{count}</div>
          <p className="mt-1 text-[0.85rem] font-medium text-slate-500">{caption}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: accent }}>
          {icon}
        </div>
      </div>
    </article>
  );
}

function badgeClassForAction(action: string) {
  return actionBadgeClass[action] ?? "bg-slate-100 text-slate-700 ring-slate-200";
}

function collectOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

export function AuditLogsContent() {
  const router = useRouter();
  const { entries, appendAuditLog } = useAuditLog();
  const [filters, setFilters] = useState<FilterState>({
    query: "",
    user: "All Users",
    module: "All Modules",
    recordType: "All Record Types",
    action: "All Actions",
    fromDate: "",
    toDate: "",
  });
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [filters.query, filters.user, filters.module, filters.recordType, filters.action, filters.fromDate, filters.toDate, rowsPerPage]);

  const summary = useMemo(() => {
    const total = entries.length;
    const auth = entries.filter((entry) => entry.module === "Auth").length;
    const navigation = entries.filter((entry) => entry.module === "Navigation").length;
    const dataChanges = entries.filter((entry) => entry.action === "Created" || entry.action === "Updated" || entry.action === "Deleted").length;
    const exports = entries.filter((entry) => entry.action === "Exported").length;
    const sidebar = entries.filter((entry) => entry.recordType === "Sidebar").length;

    return { total, auth, navigation, dataChanges, exports, sidebar };
  }, [entries]);

  const filterOptions = useMemo(() => {
    return {
      users: collectOptions(entries.map((entry) => entry.user)),
      modules: collectOptions(entries.map((entry) => entry.module)),
      recordTypes: collectOptions(entries.map((entry) => entry.recordType)),
      actions: collectOptions(entries.map((entry) => entry.action)),
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const query = filters.query.trim().toLowerCase();

    return entries.filter((entry) => {
      const localDateKey = createLocalDateKey(entry.timestamp);
      const fields = [
        formatAuditTimestamp(entry.timestamp).date,
        formatAuditTimestamp(entry.timestamp).time,
        entry.user,
        entry.module,
        entry.recordType,
        entry.recordId,
        entry.action,
        entry.fieldChanged,
        entry.oldValue,
        entry.newValue,
        entry.details ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (query && !fields.includes(query)) {
        return false;
      }

      if (filters.user !== "All Users" && entry.user !== filters.user) {
        return false;
      }

      if (filters.module !== "All Modules" && entry.module !== filters.module) {
        return false;
      }

      if (filters.recordType !== "All Record Types" && entry.recordType !== filters.recordType) {
        return false;
      }

      if (filters.action !== "All Actions" && entry.action !== filters.action) {
        return false;
      }

      if (filters.fromDate && localDateKey < filters.fromDate) {
        return false;
      }

      if (filters.toDate && localDateKey > filters.toDate) {
        return false;
      }

      return true;
    });
  }, [entries, filters.action, filters.fromDate, filters.module, filters.query, filters.recordType, filters.toDate, filters.user]);

  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / rowsPerPage));
  const safePage = Math.min(page, pageCount);
  const pageEntries = filteredEntries.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);
  const firstVisible = filteredEntries.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const lastVisible = filteredEntries.length === 0 ? 0 : Math.min(safePage * rowsPerPage, filteredEntries.length);
  const startPage = Math.max(1, Math.min(safePage - 2, Math.max(1, pageCount - 4)));
  const visiblePages = Array.from({ length: Math.min(5, pageCount) }, (_, index) => startPage + index);

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleExport() {
    if (filteredEntries.length === 0) {
      return;
    }

    const headers = ["Date & Time", "User", "Module", "Record Type", "Record ID", "Action", "Field Changed", "Old Value", "New Value", "Details"];
    const csvRows = [
      headers.join(","),
      ...filteredEntries.map((entry) =>
        [
          JSON.stringify(formatAuditTimestamp(entry.timestamp).date + " " + formatAuditTimestamp(entry.timestamp).time),
          JSON.stringify(entry.user),
          JSON.stringify(entry.module),
          JSON.stringify(entry.recordType),
          JSON.stringify(entry.recordId),
          JSON.stringify(entry.action),
          JSON.stringify(entry.fieldChanged),
          JSON.stringify(entry.oldValue),
          JSON.stringify(entry.newValue),
          JSON.stringify(entry.details ?? ""),
        ].join(","),
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    appendAuditLog({
      user: "Admin",
      module: "Audit Logs",
      recordType: "Report",
      recordId: `export-${Date.now()}`,
      action: "Exported",
      fieldChanged: "Rows exported",
      oldValue: "0",
      newValue: String(filteredEntries.length),
      details: "Exported the visible audit log rows to CSV.",
    });
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 animate-fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <span>Home</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-700">Audit Logs</span>
            </div>
            <h1 className="mt-2 text-[1.65rem] font-extrabold tracking-[-0.04em] text-slate-900 sm:text-[1.9rem]">
              Audit Logs
            </h1>
            <p className="mt-1 text-[0.9rem] text-slate-500 sm:text-[0.95rem]">
              Live activity trail for sign in, navigation, exports, and record changes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <DashboardIcon className="h-4 w-4" />
              Back to Dashboard
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={filteredEntries.length === 0}
            >
              Export
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <InfoCard title="Total Logs" count={summary.total} caption="All time activity" accent="#effaf7" icon={<ShieldIcon className="h-5 w-5 text-brand-600" />} />
        <InfoCard title="Auth Events" count={summary.auth} caption="Sign in / sign up / sign out" accent="#ecfdf5" icon={<UserIcon className="h-5 w-5 text-emerald-600" />} />
        <InfoCard title="Navigation" count={summary.navigation} caption="Page and menu views" accent="#f5f3ff" icon={<DashboardIcon className="h-5 w-5 text-violet-600" />} />
        <InfoCard title="Data Changes" count={summary.dataChanges} caption="Create, update, delete" accent="#fff7ed" icon={<ShieldIcon className="h-5 w-5 text-amber-600" />} />
        <InfoCard title="Sidebar Actions" count={summary.sidebar} caption="Opened and closed sidebar" accent="#fef2f2" icon={<MenuDotsIcon className="h-5 w-5 text-rose-600" />} />
        <InfoCard title="Exports" count={summary.exports} caption="CSV downloads" accent="#ecfeff" icon={<CalendarIcon className="h-5 w-5 text-cyan-600" />} />
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="grid gap-3 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Search</label>
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.query}
                onChange={(event) => updateFilter("query", event.target.value)}
                placeholder="Search by user, module, record id, action..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Date From</label>
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={filters.fromDate}
                onChange={(event) => updateFilter("fromDate", event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Date To</label>
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={filters.toDate}
                onChange={(event) => updateFilter("toDate", event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">User</label>
            <div className="relative">
              <select
                value={filters.user}
                onChange={(event) => updateFilter("user", event.target.value)}
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
              >
                <option>All Users</option>
                {filterOptions.users.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Module</label>
            <div className="relative">
              <select
                value={filters.module}
                onChange={(event) => updateFilter("module", event.target.value)}
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
              >
                <option>All Modules</option>
                {filterOptions.modules.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Action</label>
            <div className="relative">
              <select
                value={filters.action}
                onChange={(event) => updateFilter("action", event.target.value)}
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
              >
                <option>All Actions</option>
                {filterOptions.actions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "120ms" }}>
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full border-separate border-spacing-0">
            <thead className="bg-slate-50/80">
              <tr className="text-left text-[0.78rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                {["Date & Time", "User", "Module", "Record Type", "Record ID", "Action", "Field Changed", "Old Value", "New Value"].map((column) => (
                  <th key={column} className="border-b border-slate-200 px-4 py-3.5">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageEntries.length > 0 ? (
                pageEntries.map((entry, index) => {
                  const timestamp = formatAuditTimestamp(entry.timestamp);
                  return (
                    <tr key={entry.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                      <td className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
                        <div>{timestamp.date}</div>
                        <div className="text-xs text-slate-500">{timestamp.time}</div>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">{entry.user}</td>
                      <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{entry.module}</td>
                      <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{entry.recordType}</td>
                      <td className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{entry.recordId}</td>
                      <td className="border-b border-slate-100 px-4 py-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ring-1 ${badgeClassForAction(entry.action)}`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{entry.fieldChanged || "-"}</td>
                      <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{entry.oldValue || "-"}</td>
                      <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{entry.newValue || "-"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="mx-auto max-w-md space-y-3">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <ShieldIcon className="h-6 w-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">No audit logs yet</h3>
                      <p className="text-sm leading-6 text-slate-500">
                        Log in, navigate through the ERP, or export data to see activity appear here automatically.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
          <div>
            Showing {firstVisible} to {lastVisible} of {filteredEntries.length} entries
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>

            <div className="flex items-center gap-1">
              {visiblePages.map((pageNumber) => {
                if (pageNumber > pageCount) {
                  return null;
                }

                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={[
                      "min-w-9 rounded-full px-3 py-2 text-sm font-semibold transition",
                      pageNumber === safePage
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={safePage === pageCount}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
              <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Rows per page</span>
              <select
                value={rowsPerPage}
                onChange={(event) => setRowsPerPage(Number(event.target.value))}
                className="bg-transparent text-sm font-semibold text-slate-700 outline-none"
              >
                {[10, 20, 50].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
