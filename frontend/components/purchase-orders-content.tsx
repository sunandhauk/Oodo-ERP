"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useAuditLog } from "@/components/audit-log-provider";
import { ChevronDownIcon, SearchIcon } from "@/components/icons";
import { useProducts } from "@/components/products-store";
import { usePurchaseOrders } from "@/components/purchase-orders-store";
import type { SessionUser } from "@/lib/auth-types";
import type { PurchaseOrderDraft, PurchaseOrderLine, PurchaseOrderRecord, PurchaseOrderStatus } from "@/lib/purchase-orders";
import { getNextPurchaseOrderReference } from "@/lib/purchase-orders";
import { buildListPath } from "@/lib/list-filters";

type UserLookup = {
  id: string;
  login_id: string;
  full_name: string;
  email: string;
  status: string;
};

function Badge({ status }: { status: PurchaseOrderStatus }) {
  const className =
    status === "Confirmed"
      ? "bg-sky-50 text-sky-700"
      : status === "Partially Received"
        ? "bg-blue-50 text-blue-700"
        : status === "Fully Received"
          ? "bg-emerald-50 text-emerald-700"
          : status === "Cancelled"
            ? "bg-red-50 text-red-700"
            : status === "Pending"
              ? "bg-amber-50 text-amber-700"
              : status === "Received"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${className}`}>
      <span className="h-2 w-2 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

function SectionCard({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[0.25rem] border border-slate-200 bg-white shadow-[0_16px_38px_rgba(15,23,42,0.05)] ${className}`}>
      {title ? <div className="border-b border-slate-100 px-4 py-4 text-[0.98rem] font-extrabold tracking-[-0.03em] text-slate-900">{title}</div> : null}
      {children}
    </section>
  );
}

function formatDisplayTimestamp(order: PurchaseOrderRecord) {
  return (
    <div>
      <div className="text-[0.94rem] font-semibold text-slate-900">{order.date}</div>
      <div className="text-[0.78rem] text-slate-500">{order.time}</div>
    </div>
  );
}

function makeDefaultLine(): PurchaseOrderLine {
  return {
    product: "",
    orderedQuantity: 1,
    receivedQuantity: 0,
    units: "Nos",
    unitCost: 0,
  };
}

function isFinalPurchaseStatus(status: PurchaseOrderStatus) {
  return status === "Fully Received" || status === "Cancelled";
}

function isReceivingPurchaseStatus(status: PurchaseOrderStatus) {
  return status === "Confirmed" || status === "Partially Received";
}

function formatCreationDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatCreationTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getLineTotal(line: PurchaseOrderLine, status: PurchaseOrderStatus) {
  const quantity = isReceivingPurchaseStatus(status) || isFinalPurchaseStatus(status) ? line.receivedQuantity : line.orderedQuantity;
  return quantity * line.unitCost;
}

function SearchToolbarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="5.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function FilterToolbarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16l-6 7v4l-4 2v-6L4 6Z" />
    </svg>
  );
}

function TableToolbarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M4 9h16M9 4v16" />
    </svg>
  );
}

function GridToolbarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="6" height="16" rx="1.5" />
      <rect x="14" y="4" width="6" height="7" rx="1.5" />
      <rect x="14" y="13" width="6" height="7" rx="1.5" />
    </svg>
  );
}

type PurchaseOrdersContentProps = {
  isAdmin?: boolean;
  canCreate?: boolean;
};

export function PurchaseOrdersContent({ isAdmin = false, canCreate = false }: PurchaseOrdersContentProps) {
  void isAdmin;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { appendAuditLog } = useAuditLog();
  const { orders } = usePurchaseOrders();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const query = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "All Status";

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    appendAuditLog({
      user: "Admin",
      module: "Purchase Orders",
      recordType: "Page",
      recordId: "/purchase-orders",
      action: "Viewed",
      fieldChanged: "Route",
      oldValue: "-",
      newValue: "/purchase-orders",
      details: "Purchase orders list opened",
    });
  }, [appendAuditLog]);

  useEffect(() => {
    setPage(1);
  }, [query, status, rowsPerPage]);

  function activateTableView() {
    setViewMode("table");
    appendAuditLog({
      user: "Admin",
      module: "Purchase Orders",
      recordType: "View",
      recordId: "table",
      action: "Viewed",
      fieldChanged: "Layout",
      oldValue: "cards",
      newValue: "table",
      details: "Purchase orders switched to normal table view",
    });
  }

  function activateCardsView() {
    setViewMode("cards");
    appendAuditLog({
      user: "Admin",
      module: "Purchase Orders",
      recordType: "View",
      recordId: "cards",
      action: "Viewed",
      fieldChanged: "Layout",
      oldValue: "table",
      newValue: "cards",
      details: "Purchase orders switched to card view",
    });
  }

  function updateQuery(nextQuery: string) {
    router.replace(buildListPath(pathname, searchParams, { q: nextQuery }), { scroll: false });
  }

  function updateStatus(nextStatus: string) {
    router.replace(buildListPath(pathname, searchParams, { status: nextStatus }), { scroll: false });
  }

  function clearFilters() {
    router.replace(buildListPath(pathname, searchParams, { q: "", status: "All Status" }), { scroll: false });
    setSearchOpen(false);
    setFilterOpen(false);
  }

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();

    return orders.filter((order) => {
      const haystack = [order.reference, order.vendor, order.responsible, order.status, order.date, order.time].join(" ").toLowerCase();

      if (q && !haystack.includes(q)) {
        return false;
      }

      if (status !== "All Status" && order.status !== status) {
        return false;
      }

      return true;
    });
  }, [orders, query, status]);

  const total = filteredOrders.length;
  const pageCount = Math.max(1, Math.ceil(total / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const pageOrders = filteredOrders.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const firstVisible = total === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const lastVisible = total === 0 ? 0 : Math.min(currentPage * rowsPerPage, total);
  const startPage = Math.max(1, Math.min(currentPage - 2, Math.max(1, pageCount - 4)));
  const visiblePages = Array.from({ length: Math.min(5, pageCount) }, (_, index) => startPage + index);

  function handleExport() {
    const csvRows = [
      ["Reference", "Date", "Vendor", "Responsible", "Status", "Total Amount"].join(","),
      ...filteredOrders.map((order) =>
        [order.reference, order.date, order.vendor, order.responsible, order.status, order.grandTotal].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "purchase-orders.csv";
    link.click();
    URL.revokeObjectURL(url);

    appendAuditLog({
      user: "Admin",
      module: "Purchase Orders",
      recordType: "Export",
      recordId: "csv",
      action: "Exported",
      fieldChanged: "Rows",
      oldValue: "-",
      newValue: String(filteredOrders.length),
      details: "Exported purchase orders list",
    });
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <Breadcrumbs items={[{ label: "Home", href: "/dashboard" }, { label: "Purchase Orders" }]} />

        {canCreate ? (
          <button
            type="button"
            onClick={() => router.push("/purchase-orders/new")}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(31,158,122,0.2)] transition hover:bg-brand-700"
          >
            <span className="text-lg leading-none">+</span>
            New Purchase Order
          </button>
        ) : null}
      </section>

      <SectionCard>
        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((current) => !current);
                  setFilterOpen(false);
                }}
                className={[
                  "inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition",
                  searchOpen ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
                aria-pressed={searchOpen}
                aria-label="Search"
              >
                <SearchToolbarIcon />
              </button>
              <button
                type="button"
                onClick={() => setFilterOpen((current) => !current)}
                className={[
                  "inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition",
                  filterOpen ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
                aria-pressed={filterOpen}
                aria-label="Filter"
              >
                <FilterToolbarIcon />
              </button>
              <button
                type="button"
                onClick={activateTableView}
                className={[
                  "inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition",
                  viewMode === "table" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
                aria-pressed={viewMode === "table"}
                aria-label="Normal view"
              >
                <TableToolbarIcon />
              </button>
              <button
                type="button"
                onClick={activateCardsView}
                className={[
                  "inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition",
                  viewMode === "cards" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
                aria-pressed={viewMode === "cards"}
                aria-label="Card view"
              >
                <GridToolbarIcon />
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Export
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={rowsPerPage}
                onChange={(event) => setRowsPerPage(Number(event.target.value))}
                className="h-11 appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
              >
                {[10, 20, 50].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none -ml-10 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {(searchOpen || filterOpen) && (
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {searchOpen ? (
                <div className="xl:col-span-1">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Search</label>
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={searchInputRef}
                      value={query}
                      onChange={(event) => updateQuery(event.target.value)}
                      placeholder="Search by reference, vendor, responsible..."
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
                    />
                  </div>
                </div>
              ) : null}

              {filterOpen ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:col-span-1">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</label>
                    <div className="relative">
                      <select
                        value={status}
                        onChange={(event) => updateStatus(event.target.value)}
                        className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
                      >
                        {["All Status", "Draft", "Confirmed", "Partially Received", "Fully Received", "Cancelled", "Pending", "Received"].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                      <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reset</label>
                    <button
                      type="button"
                      onClick={() => {
                        clearFilters();
                      }}
                      className="flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Clear filters
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {viewMode === "table" ? (
            <table className="min-w-[1120px] w-full border-separate border-spacing-0">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-[0.78rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {["", "Reference", "Date", "Vendor", "Responsible", "Status", "Total Amount", ""].map((column, index) => (
                    <th key={`${column}-${index}`} className="border-b border-slate-200 px-4 py-3.5">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageOrders.map((order, index) => (
                  <tr key={order.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">{order.reference}</td>
                    <td className="border-b border-slate-100 px-4 py-4">{formatDisplayTimestamp(order)}</td>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">{order.vendor}</td>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">{order.responsible}</td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <Badge status={order.status} />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">
                      Rs. {order.grandTotal.toLocaleString("en-IN")}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4 text-right">
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Row actions"
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                          <circle cx="12" cy="5" r="1.6" />
                          <circle cx="12" cy="12" r="1.6" />
                          <circle cx="12" cy="19" r="1.6" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="min-w-[840px] p-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => {
                      setViewMode("table");
                      appendAuditLog({
                        user: "Admin",
                        module: "Purchase Orders",
                        recordType: "Purchase Order",
                        recordId: order.reference,
                        action: "Viewed",
                        fieldChanged: "Card",
                        oldValue: "cards",
                        newValue: "table",
                        details: `Opened ${order.reference} from card view`,
                      });
                    }}
                    className="rounded-[0.25rem] border border-slate-200 bg-white p-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[1.05rem] font-extrabold tracking-[-0.04em] text-blue-700">{order.reference}</div>
                        <div className="mt-4 text-[1rem] font-semibold text-slate-900">{order.vendor}</div>
                        <div className="mt-2 text-[0.9rem] text-slate-500">{order.date}</div>
                      </div>
                      <Badge status={order.status} />
                    </div>
                    <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
                      <span>{order.responsible}</span>
                      <span>Rs. {order.grandTotal.toLocaleString("en-IN")}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {viewMode === "table" ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
            <div>
              Showing {firstVisible} to {lastVisible} of {total} entries
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <div className="flex items-center gap-1">
                {visiblePages.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={[
                      "min-w-9 rounded-full px-3 py-2 text-sm font-semibold transition",
                      pageNumber === currentPage ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={currentPage === pageCount}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

export function PurchaseOrderCreateContent({ user }: { user: SessionUser }) {
  const router = useRouter();
  const { appendAuditLog } = useAuditLog();
  const { orders, createOrder } = usePurchaseOrders();
  const { products, isLoading: productsLoading } = useProducts();
  const [creationTimestamp] = useState(() => new Date());
  const [userOptions, setUserOptions] = useState<UserLookup[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const nextReference = useMemo(() => getNextPurchaseOrderReference(orders), [orders]);
  const assignedResponsible = user.displayName.trim() || user.fullName.trim() || user.loginId.trim();
  const vendorOptions = useMemo(() => {
    const values = new Set<string>([
      "Masterfast Ltd",
      "OMN Metals",
      "Prime Components",
      "Blue Edge Traders",
      "Nova Industrial",
      "Apex Supplies",
      "Vector Materials",
      "Sigma Logistics",
      "Orbit Partners",
      "Unity Resources",
    ]);

    for (const product of products) {
      if (product.vendorName?.trim()) {
        values.add(product.vendorName.trim());
      }
    }

    for (const order of orders) {
      if (order.vendor?.trim()) {
        values.add(order.vendor.trim());
      }
    }

    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [orders, products]);
  const responsibleOptions = useMemo(
    () => [
      { id: user.sub, label: assignedResponsible, value: assignedResponsible },
      ...userOptions
        .filter((item) => item.status.toLowerCase() === "active")
        .map((item) => ({
          id: item.id,
          label: item.full_name.trim() || item.login_id.trim(),
          value: item.full_name.trim() || item.login_id.trim(),
        })),
    ].filter((item, index, array) => array.findIndex((candidate) => candidate.value === item.value) === index),
    [assignedResponsible, user.sub, userOptions],
  );
  const selectableProducts = useMemo(
    () => products.filter((product) => product.status !== "Archived"),
    [products],
  );
  const [draft, setDraft] = useState<PurchaseOrderDraft>({
    vendor: "",
    responsible: assignedResponsible,
    address: "",
    date: creationTimestamp.toISOString().slice(0, 10),
    lines: [makeDefaultLine()],
    status: "Draft",
  });
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadLookupUsers() {
      try {
        const response = await fetch("/api/users/lookup", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as { status?: string; data?: UserLookup[]; error?: unknown } | null;

        if (active && response.ok && payload?.status === "success" && Array.isArray(payload.data)) {
          setUserOptions(payload.data);
        }
      } catch {
        if (active) {
          setUserOptions([]);
        }
      } finally {
        if (active) {
          setLoadingLookups(false);
        }
      }
    }

    void loadLookupUsers();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  function updateLine(index: number, patch: Partial<PurchaseOrderLine>) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    }));
  }

  function addLine() {
    setDraft((current) => ({ ...current, lines: [...current.lines, makeDefaultLine()] }));
  }

  function removeLine(index: number) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.length > 1 ? current.lines.filter((_, lineIndex) => lineIndex !== index) : current.lines,
    }));
  }

  function applyProductSelection(index: number, productName: string) {
    const selectedProduct = selectableProducts.find((product) => product.product === productName);

    updateLine(index, {
      product: selectedProduct?.product ?? productName,
      unitCost: selectedProduct?.costPrice ?? 0,
    });
  }

  function setPurchaseStatus(nextStatus: PurchaseOrderStatus) {
    setDraft((current) => {
      if (current.status === nextStatus) {
        return current;
      }

      return {
        ...current,
        status: nextStatus,
      };
    });
  }

  function handleConfirm() {
    setErrorMessage("");
    setPurchaseStatus("Confirmed");
    appendAuditLog({
      user: user.displayName,
      module: "Purchase Orders",
      recordType: "Purchase Order",
      recordId: nextReference,
      action: "Updated",
      fieldChanged: "Status",
      oldValue: "Draft",
      newValue: "Confirmed",
      details: `Confirmed purchase order ${nextReference}`,
    });
  }

  function handleReceive() {
    setErrorMessage("");
    const fullyReceived = draft.lines.every((line) => Number(line.receivedQuantity ?? 0) >= Number(line.orderedQuantity ?? 0));
    const nextStatus: PurchaseOrderStatus = fullyReceived ? "Fully Received" : "Partially Received";

    setDraft((current) => ({
      ...current,
      status: nextStatus,
      lines: fullyReceived
        ? current.lines.map((line) => ({
            ...line,
            receivedQuantity: line.orderedQuantity,
          }))
        : current.lines,
    }));

    appendAuditLog({
      user: user.displayName,
      module: "Purchase Orders",
      recordType: "Purchase Order",
      recordId: nextReference,
      action: "Updated",
      fieldChanged: "Status",
      oldValue: draft.status,
      newValue: nextStatus,
      details: `Marked purchase order ${nextReference} as ${nextStatus}`,
    });
  }

  function handleCancel() {
    setErrorMessage("");
    setPurchaseStatus("Cancelled");
    appendAuditLog({
      user: user.displayName,
      module: "Purchase Orders",
      recordType: "Purchase Order",
      recordId: nextReference,
      action: "Updated",
      fieldChanged: "Status",
      oldValue: draft.status,
      newValue: "Cancelled",
      details: `Cancelled purchase order ${nextReference}`,
    });
  }

  async function submit(status: PurchaseOrderStatus) {
    const validationMessage = !draft.vendor.trim()
      ? "Please select a vendor."
      : !draft.responsible.trim()
        ? "Please select a responsible person."
        : !draft.address.trim()
          ? "Please enter a vendor address."
          : draft.lines.some((line) => !line.product.trim())
            ? "Please select a product for every line."
            : "";

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const nextOrder = await createOrder({ ...draft, status });
      appendAuditLog({
        user: "Admin",
        module: "Purchase Orders",
        recordType: "Purchase Order",
        recordId: nextOrder.reference,
        action: "Created",
        fieldChanged: "Order",
        oldValue: "Draft",
        newValue: status,
        details: `Created purchase order ${nextOrder.reference}`,
      });
      router.replace("/purchase-orders");
    } finally {
      setSaving(false);
    }
  }

  const isDraft = draft.status === "Draft";
  const isReceiving = isReceivingPurchaseStatus(draft.status);
  const isFinalized = isFinalPurchaseStatus(draft.status);
  const grandTotal = draft.lines.reduce((sum, line) => sum + getLineTotal(line, draft.status), 0);
  const creationDateLabel = formatCreationDate(creationTimestamp);
  const creationTimeLabel = formatCreationTime(creationTimestamp);

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start justify-between gap-4 animate-fade-up">
        <div>
          <Breadcrumbs items={[{ label: "Home", href: "/dashboard" }, { label: "Purchase Orders", href: "/purchase-orders" }, { label: "Create" }]} />
          <h1 className="mt-2 text-[1.65rem] font-extrabold tracking-[-0.04em] text-slate-900 sm:text-[1.9rem]">Purchase Order - Create</h1>
          <p className="mt-1 text-sm text-slate-500">Draft a purchase order, confirm it, and track receipts from the same screen.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/purchase-orders")}
            className="rounded-[0.25rem] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          {draft.status === "Draft" ? (
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-[0.25rem] border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
            >
              Confirm
            </button>
          ) : null}
          {isReceiving ? (
            <button
              type="button"
              onClick={handleReceive}
              className="rounded-[0.25rem] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              Receive
            </button>
          ) : null}
          {!isFinalized ? (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-[0.25rem] border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              Cancel PO
            </button>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => submit(draft.status)}
            className="rounded-[0.25rem] bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Purchase Order"}
          </button>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-[0.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_240px]">
        <SectionCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
            <div className="text-[0.98rem] font-extrabold tracking-[-0.03em] text-slate-900">Purchase Order Details</div>
            <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">Status: {draft.status}</div>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">PO Number</label>
              <input value={nextReference} readOnly className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Creation Date</label>
              <input value={creationDateLabel} readOnly className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-900 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Creation Time</label>
              <input value={creationTimeLabel} readOnly className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-900 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Vendor *</label>
              <select
                value={draft.vendor}
                onChange={(event) => setDraft((current) => ({ ...current, vendor: event.target.value }))}
                disabled={!isDraft}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">{vendorOptions.length > 0 ? "Select vendor" : "No vendors available"}</option>
                {vendorOptions.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Responsible Person *</label>
              <select
                value={draft.responsible}
                onChange={(event) => setDraft((current) => ({ ...current, responsible: event.target.value }))}
                disabled={!isDraft}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                {responsibleOptions.map((option) => (
                  <option key={option.id} value={option.value}>
                    {option.label}
                  </option>
                ))}
                {loadingLookups && responsibleOptions.length === 1 ? <option value="">Loading users...</option> : null}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-600">Vendor Address</label>
              <textarea
                value={draft.address}
                onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
                maxLength={255}
                placeholder="Enter vendor address"
                rows={3}
                readOnly={!isDraft}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none read-only:bg-slate-100"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="p-4">
            <div className="text-[0.98rem] font-extrabold tracking-[-0.03em] text-slate-900">Quick Stats</div>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Lines</span>
                <span className="font-semibold text-slate-900">{draft.lines.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total</span>
                <span className="font-semibold text-slate-900">Rs. {grandTotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>New Ref</span>
                <span className="font-semibold text-slate-900">{nextReference}</span>
              </div>
            </div>
          </div>
        </SectionCard>
      </section>

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full border-separate border-spacing-0">
            <thead className="bg-slate-50/80">
              <tr className="text-left text-[0.78rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                {["#", "Products", "Ordered Quantity", "Received Quantity", "Units", "Cost Price", "Total", ""].map((column) => (
                  <th key={column} className="border-b border-slate-200 px-4 py-3.5">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((line, index) => {
                const lineTotal = getLineTotal(line, draft.status);
                return (
                  <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-700">{index + 1}</td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <select
                        value={line.product}
                        onChange={(event) => applyProductSelection(index, event.target.value)}
                        disabled={!isDraft || (productsLoading && selectableProducts.length === 0)}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <option value="">{productsLoading ? "Loading products..." : "Select product"}</option>
                        {selectableProducts.map((product) => (
                          <option key={product.id} value={product.product}>
                            {product.product} - Rs. {product.costPrice.toLocaleString("en-IN")}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <input
                        type="number"
                        min="0"
                        value={line.orderedQuantity}
                        onChange={(event) => updateLine(index, { orderedQuantity: Number(event.target.value) })}
                        readOnly={!isDraft}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none read-only:bg-slate-100"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <input
                        type="number"
                        min="0"
                        value={line.receivedQuantity}
                        onChange={(event) => updateLine(index, { receivedQuantity: Number(event.target.value) })}
                        readOnly={!isReceiving}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none read-only:bg-slate-100"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <input
                        value={line.units}
                        onChange={(event) => updateLine(index, { units: event.target.value })}
                        readOnly={!isDraft}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none read-only:bg-slate-100"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <input
                        type="number"
                        min="0"
                        value={line.unitCost}
                        onChange={(event) => updateLine(index, { unitCost: Number(event.target.value) })}
                        readOnly={!isDraft}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none read-only:bg-slate-100"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">Rs. {lineTotal.toLocaleString("en-IN")}</td>
                    <td className="border-b border-slate-100 px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        disabled={draft.lines.length === 1 || !isDraft}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-4">
          <button
            type="button"
            onClick={addLine}
            disabled={!isDraft}
            className="rounded-[0.25rem] border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add a product
          </button>
          <div className="text-sm font-semibold text-slate-700">
            Total: <span className="ml-2 text-slate-900">Rs. {grandTotal.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

