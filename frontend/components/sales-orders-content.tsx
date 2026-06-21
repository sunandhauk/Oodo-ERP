"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useAuditLog } from "@/components/audit-log-provider";
import { ChevronDownIcon, SearchIcon } from "@/components/icons";
import { useProducts } from "@/components/products-store";
import { useSalesOrders } from "@/components/sales-orders-store";
import type { SessionUser } from "@/lib/auth-types";
import type { SalesOrderDraft, SalesOrderLine, SalesOrderRecord, SalesOrderStatus } from "@/lib/sales-orders";
import { SALES_ORDER_CUSTOMERS, calculateSalesOrderTotal, getNextSalesOrderReference } from "@/lib/sales-orders";
import { buildListPath } from "@/lib/list-filters";

function Badge({ status }: { status: SalesOrderStatus }) {
  const className =
    status === "Confirmed"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Partially Delivered"
        ? "bg-blue-50 text-blue-700"
        : status === "Pending"
          ? "bg-amber-50 text-amber-700"
          : status === "Delivered" || status === "Fully Delivered"
            ? "bg-emerald-50 text-emerald-700"
            : status === "Cancelled"
              ? "bg-red-50 text-red-700"
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

function formatDisplayTimestamp(order: SalesOrderRecord) {
  return (
    <div>
      <div className="text-[0.94rem] font-semibold text-slate-900">{order.date}</div>
      <div className="text-[0.78rem] text-slate-500">{order.time}</div>
    </div>
  );
}

function makeDefaultLine(): SalesOrderLine {
  return {
    product: "",
    availability: "",
    orderedQuantity: 1,
    deliveredQuantity: 0,
    units: "Nos",
    unitPrice: 0,
  };
}

type UserLookup = {
  id: string;
  login_id: string;
  full_name: string;
  email: string;
  status: string;
};

function getProductAvailability(orderedQuantity: number, freeToUseQty: number) {
  if (orderedQuantity > freeToUseQty) {
    return "Insufficient";
  }

  return "Available";
}

function getLineTotal(line: SalesOrderLine, status: SalesOrderStatus) {
  const deliveredStatus = status === "Partially Delivered" || status === "Delivered" || status === "Fully Delivered";
  const quantity = deliveredStatus ? line.deliveredQuantity : line.orderedQuantity;
  return quantity * line.unitPrice;
}

type SalesOrdersContentProps = {
  initialOrders?: SalesOrderRecord[];
  isAdmin?: boolean;
  canCreate?: boolean;
};

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

export function SalesOrdersContent({ initialOrders = [], isAdmin = false, canCreate = false }: SalesOrdersContentProps) {
  void isAdmin;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { appendAuditLog } = useAuditLog();
  const { orders, replaceOrders } = useSalesOrders();
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
      module: "Sales Orders",
      recordType: "Page",
      recordId: "/sales-orders",
      action: "Viewed",
      fieldChanged: "Route",
      oldValue: "-",
      newValue: "/sales-orders",
      details: "Sales orders list opened",
    });
  }, [appendAuditLog]);

  useEffect(() => {
    if (initialOrders.length > 0 && orders.length === 0) {
      replaceOrders(initialOrders);
    }
  }, [initialOrders, orders.length, replaceOrders]);

  useEffect(() => {
    setPage(1);
  }, [query, status, rowsPerPage]);

  function activateTableView() {
    setViewMode("table");
    appendAuditLog({
      user: "Admin",
      module: "Sales Orders",
      recordType: "View",
      recordId: "table",
      action: "Viewed",
      fieldChanged: "Layout",
      oldValue: "cards",
      newValue: "table",
      details: "Sales orders switched to normal table view",
    });
  }

  function activateCardsView() {
    setViewMode("cards");
    appendAuditLog({
      user: "Admin",
      module: "Sales Orders",
      recordType: "View",
      recordId: "cards",
      action: "Viewed",
      fieldChanged: "Layout",
      oldValue: "table",
      newValue: "cards",
      details: "Sales orders switched to card view",
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
      const haystack = [order.reference, order.customer, order.salesperson, order.status, order.date, order.time].join(" ").toLowerCase();

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

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <Breadcrumbs items={[{ label: "Home", href: "/dashboard" }, { label: "Sales Orders" }]} />

        {canCreate ? (
          <button
            type="button"
            onClick={() => router.push("/sales-orders/new")}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(31,158,122,0.2)] transition hover:bg-brand-700"
          >
            <span className="text-lg leading-none">+</span>
            New Sales Order
          </button>
        ) : null}
      </section>

      <SectionCard className={viewMode === "cards" ? "overflow-hidden" : ""}>
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
                      placeholder="Search by reference, customer, salesperson..."
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
                        {["All Status", "Draft", "Confirmed", "Partially Delivered", "Pending", "Delivered", "Fully Delivered", "Cancelled"].map((value) => (
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
                {["", "Reference", "Date", "Customer", "Salesperson", "Status", ""].map((column, index) => (
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
                  <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">{order.customer}</td>
                  <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">{order.salesperson}</td>
                  <td className="border-b border-slate-100 px-4 py-4"><Badge status={order.status} /></td>
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
                        module: "Sales Orders",
                        recordType: "Sales Order",
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
                        <div className="mt-4 text-[1rem] font-semibold text-slate-900">{order.customer}</div>
                        <div className="mt-2 text-[0.9rem] text-slate-500">{order.date}</div>
                      </div>
                      <Badge status={order.status} />
                    </div>
                    <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
                      <span>{order.salesperson}</span>
                      <span>{order.time}</span>
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
                      pageNumber === currentPage
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
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

export function SalesOrderCreateContent({ user }: { user: SessionUser }) {
  const router = useRouter();
  const { appendAuditLog } = useAuditLog();
  const { orders, createOrder } = useSalesOrders();
  const { products, isLoading: productsLoading } = useProducts();
  const [creationTimestamp] = useState(() => new Date());
  const [userOptions, setUserOptions] = useState<UserLookup[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const nextReference = useMemo(() => getNextSalesOrderReference(orders), [orders]);
  const assignedSalesperson = user.displayName.trim() || user.fullName.trim() || user.loginId.trim();
  const selectableProducts = useMemo(() => products.filter((product) => product.status !== "Archived"), [products]);
  const customerOptions = useMemo(() => {
    const values = new Set<string>(SALES_ORDER_CUSTOMERS);

    for (const order of orders) {
      if (order.customer.trim()) {
        values.add(order.customer.trim());
      }
    }

    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [orders]);
  const salespersonOptions = useMemo(
    () => [
      { id: user.sub, label: assignedSalesperson, value: assignedSalesperson },
      ...userOptions
        .filter((item) => item.status.toLowerCase() === "active")
        .map((item) => ({
          id: item.id,
          label: item.full_name.trim() || item.login_id.trim(),
          value: item.full_name.trim() || item.login_id.trim(),
        })),
    ].filter((item, index, array) => array.findIndex((candidate) => candidate.value === item.value) === index),
    [assignedSalesperson, user.sub, userOptions],
  );
  const [draft, setDraft] = useState<SalesOrderDraft>({
    customer: "",
    salesperson: assignedSalesperson,
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

  function updateLine(index: number, patch: Partial<SalesOrderLine>) {
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
    const orderedQuantity = draft.lines[index]?.orderedQuantity ?? 0;

    updateLine(index, {
      product: selectedProduct?.product ?? productName,
      availability: selectedProduct ? getProductAvailability(orderedQuantity, selectedProduct.freeToUseQty ?? 0) : "",
      unitPrice: selectedProduct?.salesPrice ?? 0,
    });
  }

  function setSalesStatus(nextStatus: SalesOrderStatus) {
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
    setSalesStatus("Confirmed");
    appendAuditLog({
      user: user.displayName,
      module: "Sales Orders",
      recordType: "Sales Order",
      recordId: nextReference,
      action: "Updated",
      fieldChanged: "Status",
      oldValue: "Draft",
      newValue: "Confirmed",
      details: `Confirmed sales order ${nextReference}`,
    });
  }

  function handleDeliver() {
    setErrorMessage("");
    const fullyDelivered = draft.lines.every((line) => Number(line.deliveredQuantity ?? 0) >= Number(line.orderedQuantity ?? 0));
    const nextStatus: SalesOrderStatus = fullyDelivered ? "Fully Delivered" : "Partially Delivered";

    setDraft((current) => ({
      ...current,
      status: nextStatus,
      lines: fullyDelivered
        ? current.lines.map((line) => ({
            ...line,
            deliveredQuantity: line.orderedQuantity,
            availability: line.availability || "Available",
          }))
        : current.lines,
    }));

    appendAuditLog({
      user: user.displayName,
      module: "Sales Orders",
      recordType: "Sales Order",
      recordId: nextReference,
      action: "Updated",
      fieldChanged: "Status",
      oldValue: draft.status,
      newValue: nextStatus,
      details: `Marked sales order ${nextReference} as ${nextStatus}`,
    });
  }

  function handleCancel() {
    setErrorMessage("");
    setSalesStatus("Cancelled");
    appendAuditLog({
      user: user.displayName,
      module: "Sales Orders",
      recordType: "Sales Order",
      recordId: nextReference,
      action: "Updated",
      fieldChanged: "Status",
      oldValue: draft.status,
      newValue: "Cancelled",
      details: `Cancelled sales order ${nextReference}`,
    });
  }

  async function submit(status: SalesOrderStatus) {
    const validationMessage = !draft.customer.trim()
      ? "Please select a customer."
      : !draft.salesperson.trim()
        ? "Please select a sales person."
        : !draft.address.trim()
          ? "Please enter a customer address."
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
        user: user.displayName,
        module: "Sales Orders",
        recordType: "Sales Order",
        recordId: nextOrder.reference,
        action: "Created",
        fieldChanged: "Order",
        oldValue: "Draft",
        newValue: status,
        details: `Created sales order ${nextOrder.reference}`,
      });
      router.replace("/sales-orders");
    } finally {
      setSaving(false);
    }
  }

  const isDraft = draft.status === "Draft";
  const isDeliverable = draft.status === "Confirmed" || draft.status === "Partially Delivered";
  const isFinalized = draft.status === "Fully Delivered" || draft.status === "Cancelled";
  const grandTotal = calculateSalesOrderTotal(draft.lines, draft.status);
  const creationDateLabel = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(creationTimestamp);
  const creationTimeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(creationTimestamp);

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start justify-between gap-4 animate-fade-up">
        <div>
          <Breadcrumbs items={[{ label: "Home", href: "/dashboard" }, { label: "Sales Orders", href: "/sales-orders" }, { label: "Create" }]} />
          <h1 className="mt-2 text-[1.65rem] font-extrabold tracking-[-0.04em] text-slate-900 sm:text-[1.9rem]">Sales Order - Create</h1>
          <p className="mt-1 text-sm text-slate-500">Draft a sales order, confirm it, and track delivery from the same screen.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/sales-orders")}
            className="rounded-[0.25rem] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back
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
          {isDeliverable ? (
            <button
              type="button"
              onClick={handleDeliver}
              className="rounded-[0.25rem] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              Deliver
            </button>
          ) : null}
          {!isFinalized ? (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-[0.25rem] border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => submit(draft.status)}
            className="rounded-[0.25rem] bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Sales Order"}
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
            <div className="text-[0.98rem] font-extrabold tracking-[-0.03em] text-slate-900">Sales Order Details</div>
            <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">Status: {draft.status}</div>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Sales Order No.</label>
              <input value={nextReference} readOnly className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Creation Date</label>
              <input value={creationDateLabel} readOnly className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-900 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Creation Time</label>
              <input value={creationTimeLabel} readOnly className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-900 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Customer *</label>
              <select
                value={draft.customer}
                onChange={(event) => setDraft((current) => ({ ...current, customer: event.target.value }))}
                disabled={!isDraft}
                className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">{customerOptions.length > 0 ? "Select customer" : "No customers available"}</option>
                {customerOptions.map((customer) => (
                  <option key={customer} value={customer}>
                    {customer}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Sales Person *</label>
              <select
                value={draft.salesperson}
                onChange={(event) => setDraft((current) => ({ ...current, salesperson: event.target.value }))}
                disabled={!isDraft}
                className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                {salespersonOptions.map((option) => (
                  <option key={option.id} value={option.value}>
                    {option.label}
                  </option>
                ))}
                {loadingLookups && salespersonOptions.length === 1 ? <option value="">Loading users...</option> : null}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-600">Customer Address</label>
              <textarea
                value={draft.address}
                onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value.slice(0, 255) }))}
                maxLength={255}
                rows={3}
                disabled={!isDraft}
                placeholder="Enter customer address"
                className="w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
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
                <span className="font-semibold text-slate-900">₹ {grandTotal.toLocaleString("en-IN")}</span>
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
                {["#", "Products", "Availability", "Ordered Quantity", "Delivered Quantity", "Units", "Sales Unit Price", "Total", ""].map((column) => (
                  <th key={column} className="border-b border-slate-200 px-4 py-3.5">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((line, index) => {
                const selectedProduct = selectableProducts.find((product) => product.product === line.product);
                const lineTotal = getLineTotal(line, draft.status);
                const isLineEditable = isDraft;
                const isDeliveryEditable = draft.status === "Partially Delivered";
                return (
                  <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-700">{index + 1}</td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <select
                        value={line.product}
                        onChange={(event) => applyProductSelection(index, event.target.value)}
                        disabled={!isLineEditable || (productsLoading && selectableProducts.length === 0)}
                        className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <option value="">{productsLoading ? "Loading products..." : "Select product"}</option>
                        {selectableProducts.map((product) => (
                          <option key={product.id} value={product.product}>
                            {product.product} - ₹ {product.salesPrice.toLocaleString("en-IN")} - Free to use: {product.freeToUseQty?.toLocaleString("en-IN") ?? "0"}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <input
                        value={line.availability || (selectedProduct ? getProductAvailability(line.orderedQuantity, selectedProduct.freeToUseQty ?? 0) : "")}
                        readOnly
                        className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-900 outline-none"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={line.orderedQuantity}
                        onChange={(event) => {
                          const orderedQuantity = Number(event.target.value);
                          const selected = selectableProducts.find((product) => product.product === line.product);
                          updateLine(index, {
                            orderedQuantity,
                            availability: selected ? getProductAvailability(orderedQuantity, selected.freeToUseQty ?? 0) : line.availability,
                          });
                        }}
                        readOnly={!isLineEditable}
                        className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none read-only:bg-slate-100"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={line.deliveredQuantity}
                        onChange={(event) => updateLine(index, { deliveredQuantity: Number(event.target.value) })}
                        readOnly={!isDeliveryEditable}
                        className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none read-only:bg-slate-100"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <input
                        value={line.units}
                        onChange={(event) => updateLine(index, { units: event.target.value })}
                        readOnly={!isLineEditable}
                        className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none read-only:bg-slate-100"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <input
                        type="number"
                        min="0"
                        value={line.unitPrice}
                        readOnly
                        className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-900 outline-none"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">₹ {lineTotal.toLocaleString("en-IN")}</td>
                    <td className="border-b border-slate-100 px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        disabled={!isLineEditable}
                        className="rounded-[0.25rem] px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
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

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={addLine}
            disabled={!isDraft}
            className="inline-flex items-center gap-2 rounded-[0.25rem] border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add a product
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-500">Grand Total:</span>
            <span className="text-2xl font-extrabold tracking-[-0.05em] text-slate-900">₹ {grandTotal.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

