"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useAuditLog } from "@/components/audit-log-provider";
import { ChevronDownIcon, SearchIcon } from "@/components/icons";
import { useProducts } from "@/components/products-store";
import { useManufacturingOrders } from "@/components/manufacturing-orders-store";
import type { SessionUser } from "@/lib/auth-types";
import type {
  ManufacturingComponentLine,
  ManufacturingOrderDraft,
  ManufacturingOrderRecord,
  ManufacturingOrderStatus,
  ManufacturingWorkOrderLine,
} from "@/lib/manufacturing-orders";
import { calculateManufacturingOrderTotal, getNextManufacturingOrderReference } from "@/lib/manufacturing-orders";
import { buildListPath } from "@/lib/list-filters";
import type { BomRecord } from "@/lib/bom";

function Badge({ status }: { status: ManufacturingOrderStatus }) {
  const className =
    status === "Confirmed"
      ? "bg-emerald-50 text-emerald-700"
      : status === "In Progress"
        ? "bg-violet-50 text-violet-700"
        : status === "Done"
          ? "bg-blue-50 text-blue-700"
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
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`rounded-[0.25rem] border border-slate-200 bg-white shadow-[0_16px_38px_rgba(15,23,42,0.05)] ${className}`}>{children}</section>;
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

type ManufacturingOrdersContentProps = {
  isAdmin?: boolean;
  canCreate?: boolean;
};

function formatDisplayTimestamp(order: ManufacturingOrderRecord) {
  return (
    <div>
      <div className="text-[0.94rem] font-semibold text-slate-900">{order.date}</div>
      <div className="text-[0.78rem] text-slate-500">{order.time}</div>
    </div>
  );
}

function makeDefaultComponent(): ManufacturingComponentLine {
  return {
    component: "",
    availability: "Available",
    toConsumeUnits: 1,
    consumeUnits: 0,
    unitCost: 0,
  };
}

function makeDefaultWorkOrder(): ManufacturingWorkOrderLine {
  return {
    operation: "",
    assignee: "",
    plannedHours: 1,
    realHours: 0,
    status: "Pending",
  };
}

type UserLookup = {
  id: string;
  login_id: string;
  full_name: string;
  email: string;
  status: string;
};

function formatMinutes(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function normalizeBoms(payload: BomRecord[] | undefined) {
  return Array.isArray(payload) ? payload : [];
}

function isFinalManufacturingStatus(status: ManufacturingOrderStatus) {
  return status === "Done" || status === "Cancelled";
}

function isEditableManufacturingStatus(status: ManufacturingOrderStatus) {
  return status === "Draft" || status === "Confirmed" || status === "In Progress";
}

function scaleValue(baseValue: number, baseQuantity: number, nextQuantity: number) {
  if (baseQuantity <= 0) {
    return baseValue;
  }

  return Number(((baseValue * nextQuantity) / baseQuantity).toFixed(3));
}

function normalizeManufacturingComponentLine(
  line: ManufacturingComponentLine,
  products: Array<{ product: string; costPrice: number; freeToUseQty?: number }>,
) {
  const matchedProduct = products.find((product) => product.product === line.component);
  const toConsumeUnits = Number.isFinite(line.toConsumeUnits) ? line.toConsumeUnits : 0;
  const resolvedAvailability =
    matchedProduct && (matchedProduct.freeToUseQty ?? 0) >= toConsumeUnits ? "Available" : line.availability || "Available";

  return {
    ...line,
    availability: resolvedAvailability,
    unitCost: matchedProduct ? matchedProduct.costPrice : Number.isFinite(line.unitCost) ? line.unitCost : 0,
  };
}

function buildBomComponentLines(
  bom: BomRecord,
  quantity: number,
  products: Array<{ product: string; costPrice: number; freeToUseQty?: number }>,
) {
  const nextQuantity = Number.isFinite(quantity) ? quantity : 0;
  return bom.components.length > 0
    ? bom.components.map((component) =>
        normalizeManufacturingComponentLine(
          {
            component: component.component,
            availability: component.availability,
            toConsumeUnits: scaleValue(component.toConsumeUnits, bom.quantity || 1, nextQuantity || bom.quantity || 1),
            consumeUnits: 0,
            unitCost: 0,
          },
          products,
        ),
      )
    : [makeDefaultComponent()];
}

function buildBomWorkOrderLines(bom: BomRecord, quantity: number) {
  const nextQuantity = Number.isFinite(quantity) ? quantity : 0;
  return bom.workOrders.length > 0
    ? bom.workOrders.map((workOrder) => ({
        operation: workOrder.operation,
        assignee: workOrder.assignee,
        plannedHours: scaleValue(workOrder.plannedHours, bom.quantity || 1, nextQuantity || bom.quantity || 1),
        realHours: 0,
        status: workOrder.status,
      }))
    : [makeDefaultWorkOrder()];
}

export function ManufacturingOrdersContent({ isAdmin = false, canCreate = false }: ManufacturingOrdersContentProps) {
  void isAdmin;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { appendAuditLog } = useAuditLog();
  const { orders } = useManufacturingOrders();
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
      module: "Manufacturing Orders",
      recordType: "Page",
      recordId: "/manufacturing-orders",
      action: "Viewed",
      fieldChanged: "Route",
      oldValue: "-",
      newValue: "/manufacturing-orders",
      details: "Manufacturing orders list opened",
    });
  }, [appendAuditLog]);

  useEffect(() => {
    setPage(1);
  }, [query, status, rowsPerPage]);

  function activateTableView() {
    setViewMode("table");
    appendAuditLog({
      user: "Admin",
      module: "Manufacturing Orders",
      recordType: "View",
      recordId: "table",
      action: "Viewed",
      fieldChanged: "Layout",
      oldValue: "cards",
      newValue: "table",
      details: "Manufacturing orders switched to normal table view",
    });
  }

  function activateCardsView() {
    setViewMode("cards");
    appendAuditLog({
      user: "Admin",
      module: "Manufacturing Orders",
      recordType: "View",
      recordId: "cards",
      action: "Viewed",
      fieldChanged: "Layout",
      oldValue: "table",
      newValue: "cards",
      details: "Manufacturing orders switched to card view",
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
      const haystack = [order.reference, order.finishedProduct, order.assignee, order.status, order.componentStatus, order.date, order.time].join(" ").toLowerCase();

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
      ["Reference", "Date", "Finished Product", "Component Status", "Quantity", "Unit", "Status"].join(","),
      ...filteredOrders.map((order) =>
        [order.reference, order.date, order.finishedProduct, order.componentStatus, order.quantity, order.unit, order.status].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "manufacturing-orders.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <Breadcrumbs items={[{ label: "Home", href: "/dashboard" }, { label: "Manufacturing Orders" }]} />

        {canCreate ? (
          <button
            type="button"
            onClick={() => router.push("/manufacturing-orders/new")}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(31,158,122,0.2)] transition hover:bg-brand-700"
          >
            <span className="text-lg leading-none">+</span>
            New
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
                className={["inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition", searchOpen ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"].join(" ")}
                aria-pressed={searchOpen}
                aria-label="Search"
              >
                <SearchToolbarIcon />
              </button>
              <button
                type="button"
                onClick={() => setFilterOpen((current) => !current)}
                className={["inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition", filterOpen ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"].join(" ")}
                aria-pressed={filterOpen}
                aria-label="Filter"
              >
                <FilterToolbarIcon />
              </button>
              <button
                type="button"
                onClick={activateTableView}
                className={["inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition", viewMode === "table" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"].join(" ")}
                aria-pressed={viewMode === "table"}
                aria-label="Normal view"
              >
                <TableToolbarIcon />
              </button>
              <button
                type="button"
                onClick={activateCardsView}
                className={["inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition", viewMode === "cards" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"].join(" ")}
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
                      placeholder="Search by reference, product, assignee..."
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
                        {["All Status", "Confirmed", "Draft", "In Progress", "Done", "Cancelled"].map((value) => (
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
                  {["", "Reference", "Date", "Finished Product", "Component Status", "Quantity", "Unit", "Status", ""].map((column, index) => (
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
                    <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">{order.finishedProduct}</td>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">{order.componentStatus}</td>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">{order.quantity.toFixed(2)}</td>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">{order.unit}</td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <Badge status={order.status} />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4 text-right">
                      <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Row actions">
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
                        module: "Manufacturing Orders",
                        recordType: "Manufacturing Order",
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
                        <div className="mt-4 text-[1rem] font-semibold text-slate-900">{order.finishedProduct}</div>
                        <div className="mt-2 text-[0.9rem] text-slate-500">{order.date}</div>
                      </div>
                      <Badge status={order.status} />
                    </div>
                    <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
                      <span>{order.assignee}</span>
                      <span>{order.componentStatus}</span>
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
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                Prev
              </button>
              <div className="flex items-center gap-1">
                {visiblePages.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={["min-w-9 rounded-full px-3 py-2 text-sm font-semibold transition", pageNumber === currentPage ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"].join(" ")}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage === pageCount} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                Next
              </button>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

export function ManufacturingOrderCreateContent({ user }: { user: SessionUser }) {
  const router = useRouter();
  const { appendAuditLog } = useAuditLog();
  const { orders, createOrder } = useManufacturingOrders();
  const { products } = useProducts();
  const nextReference = useMemo(() => getNextManufacturingOrderReference(orders), [orders]);
  const creationTimestamp = useMemo(() => new Date(), []);
  const [activeTab, setActiveTab] = useState<"components" | "work-orders">("components");
  const [users, setUsers] = useState<UserLookup[]>([]);
  const [boms, setBoms] = useState<BomRecord[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ManufacturingOrderDraft>({
    finishedProduct: "",
    assignee: "",
    quantity: 1,
    unit: "Units",
    scheduleDate: new Date().toISOString().slice(0, 10),
    billOfMaterial: "",
    status: "Draft",
    components: [makeDefaultComponent()],
    workOrders: [makeDefaultWorkOrder()],
  });

  useEffect(() => {
    let active = true;

    async function loadLookups() {
      try {
        const [userResponse, bomResponse] = await Promise.all([
          fetch("/api/users/lookup", { cache: "no-store" }),
          fetch("/api/bills-of-materials", { cache: "no-store" }),
        ]);

        const userPayload = (await userResponse.json().catch(() => null)) as { status?: string; data?: UserLookup[] } | null;
        const bomPayload = (await bomResponse.json().catch(() => null)) as { status?: string; data?: BomRecord[] } | null;

        if (!active) {
          return;
        }

        if (userResponse.ok && userPayload?.status === "success" && Array.isArray(userPayload.data)) {
          setUsers(userPayload.data);
        }

        if (bomResponse.ok && bomPayload?.status === "success" && Array.isArray(bomPayload.data)) {
          setBoms(normalizeBoms(bomPayload.data));
        }
      } finally {
        if (active) {
          setLoadingLookups(false);
        }
      }
    }

    void loadLookups();

    return () => {
      active = false;
    };
  }, []);

  const activeUsers = useMemo(() => users.filter((item) => item.status.toLowerCase() === "active"), [users]);

  const filteredBoms = useMemo(() => {
    if (!draft.finishedProduct) {
      return boms;
    }

    return boms.filter((bom) => bom.finishedProduct === draft.finishedProduct);
  }, [boms, draft.finishedProduct]);

  const selectedProduct = useMemo(() => products.find((product) => product.product === draft.finishedProduct) ?? null, [draft.finishedProduct, products]);
  const selectedBom = useMemo(() => filteredBoms.find((bom) => bom.reference === draft.billOfMaterial) ?? null, [draft.billOfMaterial, filteredBoms]);
  const isDraft = draft.status === "Draft";
  const isConfirmed = draft.status === "Confirmed";
  const isFinalized = draft.status === "Done" || draft.status === "Cancelled";
  const canEditOrderFields = !isFinalized && !isConfirmed;
  const canEditWorkOrderLines = !isFinalized && (draft.status === "Draft" || draft.status === "Confirmed" || draft.status === "In Progress");
  const showConsumedQuantity = !isDraft;
  const showRealDuration = !isDraft;
  const totalCost = useMemo(
    () =>
      draft.components.reduce((sum, component) => {
        const quantity = component.consumeUnits > 0 ? component.consumeUnits : component.toConsumeUnits;
        return sum + quantity * component.unitCost;
      }, 0),
    [draft.components],
  );
  const creationDateLabel = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(creationTimestamp);
  const creationTimeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(creationTimestamp);
  const actorLabel = user.displayName || user.email || "User";

  function refreshComponents(components: ManufacturingComponentLine[]) {
    return components.map((component) => normalizeManufacturingComponentLine(component, products));
  }

  function rebuildFromBom(bom: BomRecord, quantity: number) {
    return {
      billOfMaterial: bom.reference,
      components: buildBomComponentLines(bom, quantity, products),
      workOrders: buildBomWorkOrderLines(bom, quantity),
    };
  }

  function updateFinishedProduct(nextProduct: string) {
    const product = products.find((item) => item.product === nextProduct) ?? null;
    const productBoms = nextProduct ? boms.filter((bom) => bom.finishedProduct === nextProduct) : [];
    const preferredBom = product?.bomReference ? productBoms.find((bom) => bom.reference === product.bomReference) ?? null : null;
    const nextBom = preferredBom ?? productBoms[0] ?? null;

    setDraft((current) => {
      const nextDraft: ManufacturingOrderDraft = {
        ...current,
        finishedProduct: nextProduct,
      };

      if (nextBom) {
        const hydrated = rebuildFromBom(nextBom, current.quantity);
        nextDraft.billOfMaterial = hydrated.billOfMaterial;
        nextDraft.components = hydrated.components;
        nextDraft.workOrders = hydrated.workOrders;
      } else {
        nextDraft.billOfMaterial = "";
        nextDraft.components = [makeDefaultComponent()];
        nextDraft.workOrders = [makeDefaultWorkOrder()];
      }

      return nextDraft;
    });
  }

  function updateBillOfMaterial(nextReference: string) {
    const nextBom = filteredBoms.find((bom) => bom.reference === nextReference) ?? null;

    setDraft((current) => {
      const nextDraft: ManufacturingOrderDraft = {
        ...current,
        billOfMaterial: nextReference,
      };

      if (nextBom) {
        const hydrated = rebuildFromBom(nextBom, current.quantity);
        nextDraft.components = hydrated.components;
        nextDraft.workOrders = hydrated.workOrders;
      } else {
        nextDraft.components = [makeDefaultComponent()];
        nextDraft.workOrders = [makeDefaultWorkOrder()];
      }

      return nextDraft;
    });
  }

  function updateQuantity(nextQuantity: number) {
    setDraft((current) => {
      const nextDraft = { ...current, quantity: nextQuantity };
      const nextBom = filteredBoms.find((bom) => bom.reference === current.billOfMaterial) ?? null;

      if (nextBom) {
        const hydrated = rebuildFromBom(nextBom, nextQuantity);
        nextDraft.components = hydrated.components;
        nextDraft.workOrders = hydrated.workOrders;
      }

      return nextDraft;
    });
  }

  function updateComponent(index: number, patch: Partial<ManufacturingComponentLine>) {
    setDraft((current) => ({
      ...current,
      components: refreshComponents(current.components.map((component, componentIndex) => (componentIndex === index ? { ...component, ...patch } : component))),
    }));
  }

  function addComponent() {
    setDraft((current) => ({ ...current, components: [...current.components, makeDefaultComponent()] }));
  }

  function removeComponent(index: number) {
    setDraft((current) => ({
      ...current,
      components: current.components.length > 1 ? current.components.filter((_, componentIndex) => componentIndex !== index) : current.components,
    }));
  }

  function updateWorkOrder(index: number, patch: Partial<ManufacturingWorkOrderLine>) {
    setDraft((current) => ({
      ...current,
      workOrders: current.workOrders.map((workOrder, workOrderIndex) => (workOrderIndex === index ? { ...workOrder, ...patch } : workOrder)),
    }));
  }

  function addWorkOrder() {
    setDraft((current) => ({ ...current, workOrders: [...current.workOrders, makeDefaultWorkOrder()] }));
  }

  function removeWorkOrder(index: number) {
    setDraft((current) => ({
      ...current,
      workOrders: current.workOrders.length > 1 ? current.workOrders.filter((_, workOrderIndex) => workOrderIndex !== index) : current.workOrders,
    }));
  }

  function setStatus(nextStatus: ManufacturingOrderStatus) {
    setDraft((current) => ({ ...current, status: nextStatus }));
    appendAuditLog({
      user: actorLabel,
      module: "Manufacturing Orders",
      recordType: "Manufacturing Order",
      recordId: nextReference,
      action: "Updated",
      fieldChanged: "Status",
      oldValue: draft.status,
      newValue: nextStatus,
      details: `Changed manufacturing order ${nextReference} status to ${nextStatus}`,
    });
  }

  async function submit(status: ManufacturingOrderStatus) {
    if (!draft.finishedProduct.trim()) {
      setErrorMessage("Please select a finished product.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const nextOrder = await createOrder({
        ...draft,
        status,
        components: refreshComponents(draft.components),
        workOrders: draft.workOrders.map((workOrder) => ({ ...workOrder, realHours: workOrder.realHours ?? 0 })),
      });
      appendAuditLog({
        user: actorLabel,
        module: "Manufacturing Orders",
        recordType: "Manufacturing Order",
        recordId: nextOrder.reference,
        action: "Created",
        fieldChanged: "Order",
        oldValue: "Draft",
        newValue: status,
        details: `Created manufacturing order ${nextOrder.reference}`,
      });
      router.replace("/manufacturing-orders");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create manufacturing order.";
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start justify-between gap-4 animate-fade-up">
        <div>
          <Breadcrumbs items={[{ label: "Home", href: "/dashboard" }, { label: "Manufacturing Orders", href: "/manufacturing-orders" }, { label: "Create" }]} />
          <h1 className="mt-2 text-[1.65rem] font-extrabold tracking-[-0.04em] text-slate-900 sm:text-[1.9rem]">Manufacturing Order - Create</h1>
          <p className="mt-1 text-sm text-slate-500">Select a product, hydrate the BoM, and save the order as Draft, Confirmed, or Done.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => router.push("/manufacturing-orders")} className="rounded-[0.25rem] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Back
          </button>
          {isDraft ? (
            <button type="button" onClick={() => setStatus("Confirmed")} className="rounded-[0.25rem] border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100">
              Confirm
            </button>
          ) : null}
          {!isFinalized ? (
            <button type="button" onClick={() => setStatus("Done")} className="rounded-[0.25rem] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">
              Produce
            </button>
          ) : null}
          {!isFinalized ? (
            <button type="button" onClick={() => setStatus("Cancelled")} className="rounded-[0.25rem] border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100">
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => submit(draft.status)}
            className="rounded-[0.25rem] bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Manufacturing Order"}
          </button>
        </div>
      </section>

      {errorMessage ? <div className="rounded-[0.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{errorMessage}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_240px]">
        <SectionCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
            <div className="text-[0.98rem] font-extrabold tracking-[-0.03em] text-slate-900">Manufacturing Order Details</div>
            <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">Status: {draft.status}</div>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">MO Number</label>
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
              <label className="block text-sm font-semibold text-slate-600">Schedule Date</label>
              <input
                type="date"
                value={draft.scheduleDate}
                onChange={(event) => setDraft((current) => ({ ...current, scheduleDate: event.target.value }))}
                readOnly={isFinalized}
                className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-100"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Finished Product</label>
              <select
                value={draft.finishedProduct}
                onChange={(event) => updateFinishedProduct(event.target.value)}
                disabled={loadingLookups || !canEditOrderFields}
                className="h-11 w-full appearance-none rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-100"
              >
                <option value="">{loadingLookups ? "Loading products..." : "Select Finished Product"}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.product}>
                    {product.product}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Assignee</label>
              <select
                value={draft.assignee}
                onChange={(event) => setDraft((current) => ({ ...current, assignee: event.target.value }))}
                disabled={loadingLookups || isFinalized}
                className="h-11 w-full appearance-none rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-100"
              >
                <option value="">{loadingLookups ? "Loading users..." : "Select Assignee"}</option>
                {activeUsers.map((item) => (
                  <option key={item.id} value={item.full_name || item.login_id}>
                    {item.full_name || item.login_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Quantity</label>
              <div className="flex overflow-hidden rounded-[0.25rem] border border-slate-200 bg-slate-50">
                <input
                  type="number"
                  min="0"
                  value={draft.quantity}
                  onChange={(event) => updateQuantity(Number(event.target.value))}
                  readOnly={isFinalized}
                  className="h-11 min-w-0 flex-1 bg-transparent px-4 text-sm font-semibold text-slate-900 outline-none"
                />
                <div className="flex items-center border-l border-slate-200 px-4 text-sm font-semibold text-slate-500">{draft.unit}</div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Bill of Material</label>
              <select
                value={draft.billOfMaterial}
                onChange={(event) => updateBillOfMaterial(event.target.value)}
                disabled={loadingLookups || !draft.finishedProduct || !canEditOrderFields}
                className="h-11 w-full appearance-none rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-100"
              >
                <option value="">{draft.finishedProduct ? "Select BoM" : "Select finished product first"}</option>
                {filteredBoms.map((bom) => (
                  <option key={bom.id} value={bom.reference}>
                    {bom.reference} - {bom.finishedProduct}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-600">Selected Product</label>
              <input value={selectedProduct?.product || ""} readOnly className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-900 outline-none" />
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="p-4">
            <div className="text-[0.98rem] font-extrabold tracking-[-0.03em] text-slate-900">Quick Stats</div>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Components</span>
                <span className="font-semibold text-slate-900">{draft.components.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Work Orders</span>
                <span className="font-semibold text-slate-900">{draft.workOrders.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>BoM</span>
                <span className="font-semibold text-slate-900">{draft.billOfMaterial || "None"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Resolved BoM</span>
                <span className="font-semibold text-slate-900">{selectedBom?.reference || "None"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total</span>
                <span className="font-semibold text-slate-900">Rs. {totalCost.toLocaleString("en-IN")}</span>
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
        <div className="border-b border-slate-100 px-4 pt-4">
          <div className="grid grid-cols-2 gap-2 rounded-[0.25rem] bg-slate-100 p-1">
            <button type="button" onClick={() => setActiveTab("components")} className={["rounded-[0.25rem] px-4 py-2 text-sm font-semibold transition", activeTab === "components" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-white/70"].join(" ")}>
              Components
            </button>
            <button type="button" onClick={() => setActiveTab("work-orders")} className={["rounded-[0.25rem] px-4 py-2 text-sm font-semibold transition", activeTab === "work-orders" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-white/70"].join(" ")}>
              Work Orders
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeTab === "components" ? (
            <>
              <table className="min-w-[1120px] w-full border-separate border-spacing-0">
                <thead className="bg-slate-50/80">
                  <tr className="text-left text-[0.78rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {["#", "Components", "Availability", "To Consume Units", ...(showConsumedQuantity ? ["Consumed Quantity"] : []), "Unit Cost", "Total", ""].map((column) => (
                      <th key={column} className="border-b border-slate-200 px-4 py-3.5">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {draft.components.map((component, index) => {
                    const lineTotal = (component.consumeUnits > 0 ? component.consumeUnits : component.toConsumeUnits) * component.unitCost;
                    return (
                      <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                        <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-700">{index + 1}</td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          <select
                            value={component.component}
                            onChange={(event) => updateComponent(index, { component: event.target.value })}
                            disabled={isFinalized}
                            className="h-11 w-full appearance-none rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-100"
                          >
                            <option value="">Select product</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.product}>
                                {product.product}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          <input value={component.availability} readOnly className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-900 outline-none" />
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          <input
                            type="number"
                            min="0"
                            value={component.toConsumeUnits}
                            onChange={(event) => updateComponent(index, { toConsumeUnits: Number(event.target.value) })}
                            readOnly={isFinalized}
                            className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-100"
                          />
                        </td>
                        {showConsumedQuantity ? (
                          <td className="border-b border-slate-100 px-4 py-4">
                            <input
                              type="number"
                              min="0"
                              value={component.consumeUnits}
                              onChange={(event) => updateComponent(index, { consumeUnits: Number(event.target.value) })}
                              readOnly={isFinalized || draft.status !== "Confirmed" && draft.status !== "In Progress"}
                              className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-100"
                            />
                          </td>
                        ) : null}
                        <td className="border-b border-slate-100 px-4 py-4">
                          <input
                            type="number"
                            min="0"
                            value={component.unitCost}
                            onChange={(event) => updateComponent(index, { unitCost: Number(event.target.value) })}
                            readOnly={isFinalized}
                            className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-100"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">Rs. {lineTotal.toLocaleString("en-IN")}</td>
                        <td className="border-b border-slate-100 px-4 py-4 text-right">
                          <button type="button" onClick={() => removeComponent(index)} disabled={isFinalized || draft.components.length === 1} className="rounded-[0.25rem] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-4">
                <button type="button" onClick={addComponent} disabled={isFinalized} className="rounded-[0.25rem] border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
                  + Add Component
                </button>
                <div className="text-sm font-semibold text-slate-700">
                  Total: <span className="ml-2 text-slate-900">Rs. {totalCost.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <table className="min-w-[1120px] w-full border-separate border-spacing-0">
                <thead className="bg-slate-50/80">
                  <tr className="text-left text-[0.78rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {["#", "Operation", "Work Center", "Expected Duration", ...(showRealDuration ? ["Real Duration"] : []), "Status", ""].map((column) => (
                      <th key={column} className="border-b border-slate-200 px-4 py-3.5">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {draft.workOrders.map((workOrder, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                      <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-700">{index + 1}</td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        <input
                          value={workOrder.operation}
                          onChange={(event) => updateWorkOrder(index, { operation: event.target.value })}
                          placeholder="Operation"
                          readOnly={!canEditWorkOrderLines}
                          className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-100"
                        />
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        <select
                          value={workOrder.assignee}
                          onChange={(event) => updateWorkOrder(index, { assignee: event.target.value })}
                          disabled={!canEditWorkOrderLines}
                          className="h-11 w-full appearance-none rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-100"
                        >
                          <option value="">Select work center</option>
                          {activeUsers.map((item) => (
                            <option key={item.id} value={item.full_name || item.login_id}>
                              {item.full_name || item.login_id}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        <input
                          type="number"
                          min="0"
                          value={workOrder.plannedHours}
                          onChange={(event) => updateWorkOrder(index, { plannedHours: Number(event.target.value) })}
                          readOnly={!canEditWorkOrderLines}
                          className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-100"
                        />
                      </td>
                      {showRealDuration ? (
                        <td className="border-b border-slate-100 px-4 py-4">
                          <input
                            type="number"
                            min="0"
                            value={workOrder.realHours}
                            onChange={(event) => updateWorkOrder(index, { realHours: Number(event.target.value) })}
                            readOnly={isFinalized || draft.status === "Draft"}
                            className="h-11 w-full rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-100"
                          />
                        </td>
                      ) : null}
                      <td className="border-b border-slate-100 px-4 py-4">
                        <select
                          value={workOrder.status}
                          onChange={(event) => updateWorkOrder(index, { status: event.target.value as ManufacturingWorkOrderLine["status"] })}
                          disabled={!canEditWorkOrderLines}
                          className="h-11 w-full appearance-none rounded-[0.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-100"
                        >
                          {["Pending", "Ready", "In Progress", "Done"].map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 text-right">
                        <button type="button" onClick={() => removeWorkOrder(index)} disabled={!canEditWorkOrderLines || draft.workOrders.length === 1} className="rounded-[0.25rem] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-4">
                <button type="button" onClick={addWorkOrder} disabled={!canEditWorkOrderLines} className="rounded-[0.25rem] border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
                  + Add Work Order
                </button>
                <div className="text-sm font-semibold text-slate-700">
                  Total: <span className="ml-2 text-slate-900">Rs. {totalCost.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

