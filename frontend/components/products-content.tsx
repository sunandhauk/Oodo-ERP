"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useAuditLog } from "@/components/audit-log-provider";
import { ChevronDownIcon, SearchIcon } from "@/components/icons";
import { useProducts } from "@/components/products-store";
import type { ProductRecord, ProductStatus } from "@/lib/products";
import { buildSearchPath } from "@/lib/search-params";
function Badge({ status }: { status: ProductStatus }) {
  const className =
    status === "Active"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Draft"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${className}`}>
      <span className="h-2 w-2 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

function SectionCard({ children, className = "" }: { children: ReactNode; className?: string }) {
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

function formatCurrency(value: number) {
  return `₹ ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type ProductsContentProps = {
  initialProducts?: ProductRecord[];
  canCreate?: boolean;
};

export function ProductsContent({ initialProducts = [], canCreate = false }: ProductsContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { appendAuditLog } = useAuditLog();
  const { products, replaceProducts, createProduct } = useProducts();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [status, setStatus] = useState<string>("All Status");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const query = searchParams.get("q") ?? "";

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    appendAuditLog({
      user: "Admin",
      module: "Products",
      recordType: "Page",
      recordId: "/products",
      action: "Viewed",
      fieldChanged: "Route",
      oldValue: "-",
      newValue: "/products",
      details: "Products list opened",
    });
  }, [appendAuditLog]);

  useEffect(() => {
    if (initialProducts.length > 0) {
      replaceProducts(initialProducts);
    }
  }, [initialProducts, replaceProducts]);

  useEffect(() => {
    setPage(1);
  }, [query, status, rowsPerPage]);

  function activateTableView() {
    setViewMode("table");
    appendAuditLog({
      user: "Admin",
      module: "Products",
      recordType: "View",
      recordId: "table",
      action: "Viewed",
      fieldChanged: "Layout",
      oldValue: "cards",
      newValue: "table",
      details: "Products switched to normal table view",
    });
  }

  function activateCardsView() {
    setViewMode("cards");
    appendAuditLog({
      user: "Admin",
      module: "Products",
      recordType: "View",
      recordId: "cards",
      action: "Viewed",
      fieldChanged: "Layout",
      oldValue: "table",
      newValue: "cards",
      details: "Products switched to card view",
    });
  }

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return products.filter((product) => {
      const haystack = [product.reference, product.product, product.category, product.status, product.description].join(" ").toLowerCase();

      if (q && !haystack.includes(q)) {
        return false;
      }

      if (status !== "All Status" && product.status !== status) {
        return false;
      }

      return true;
    });
  }, [products, query, status]);

  const total = filteredProducts.length;
  const pageCount = Math.max(1, Math.ceil(total / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const pageProducts = filteredProducts.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const firstVisible = total === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const lastVisible = total === 0 ? 0 : Math.min(currentPage * rowsPerPage, total);
  const startPage = Math.max(1, Math.min(currentPage - 2, Math.max(1, pageCount - 4)));
  const visiblePages = Array.from({ length: Math.min(5, pageCount) }, (_, index) => startPage + index);

  function handleExport() {
    const csvRows = [
      ["Reference", "Product", "Sales Price", "Cost Price", "On Hand Qty", "Status"].join(","),
      ...filteredProducts.map((product) => [product.reference, product.product, product.salesPrice, product.costPrice, product.onHandQty, product.status].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "products.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function removeProduct(product: ProductRecord) {
    const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => null)) as { status?: string; error?: { message?: string } | string } | null;
    if (!response.ok || payload?.status !== "success") {
      throw new Error(typeof payload?.error === "string" ? payload.error : payload?.error?.message || "Unable to delete product.");
    }

    replaceProducts(products.filter((item) => item.id !== product.id));
    setOpenMenuId(null);
    appendAuditLog({
      user: "Admin",
      module: "Products",
      recordType: "Product",
      recordId: product.reference,
      action: "Deleted",
      fieldChanged: "Row action",
      oldValue: product.reference,
      newValue: "-",
      details: `Deleted product ${product.reference}`,
    });
  }

  function updateQuery(nextQuery: string) {
    router.replace(buildSearchPath(pathname, searchParams, nextQuery), { scroll: false });
  }

  async function duplicateProduct(product: ProductRecord) {
    const next = await createProduct({
      product: `${product.product} Copy`,
      salesPrice: product.salesPrice,
      costPrice: product.costPrice,
      onHandQty: product.onHandQty,
      category: product.category,
      description: product.description,
      status: product.status,
      imageUrl: product.imageUrl,
      procureOnDemand: product.procureOnDemand,
      procureSource: product.procureSource,
      minimumQty: product.minimumQty,
      freeToUseQty: product.freeToUseQty,
      vendorName: product.vendorName,
      bomReference: product.bomReference,
    });
    setOpenMenuId(null);
    appendAuditLog({
      user: "Admin",
      module: "Products",
      recordType: "Product",
      recordId: product.reference,
      action: "Created",
      fieldChanged: "Duplicate",
      oldValue: product.reference,
      newValue: next.reference,
      details: `Duplicated product ${product.reference} as ${next.reference}`,
    });
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <Breadcrumbs items={[{ label: "Home", href: "/dashboard" }, { label: "Products" }]} />

        {canCreate ? (
          <button
            type="button"
            onClick={() => router.push("/products/new")}
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
                      placeholder="Search by reference, product, category..."
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
                        onChange={(event) => setStatus(event.target.value)}
                        className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
                      >
                        {["All Status", "Active", "Draft", "Archived"].map((value) => (
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
                        updateQuery("");
                        setStatus("All Status");
                        setSearchOpen(false);
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
                {["", "Image", "Reference", "Product", "Sales Price", "Cost Price", "On Hand Qty", ""].map((column, index) => (
                    <th key={`${column}-${index}`} className="border-b border-slate-200 px-4 py-3.5">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageProducts.map((product, index) => (
                  <tr key={product.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <div className="h-12 w-12 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.product} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[0.7rem] font-semibold text-slate-400">No img</div>
                        )}
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">{product.reference}</td>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">{product.product}</td>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">{formatCurrency(product.salesPrice)}</td>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">{formatCurrency(product.costPrice)}</td>
                    <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">{product.onHandQty.toFixed(2)}</td>
                    <td className="border-b border-slate-100 px-4 py-4 text-right">
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId((current) => (current === product.id ? null : product.id))}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Row actions"
                        >
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                            <circle cx="12" cy="5" r="1.6" />
                            <circle cx="12" cy="12" r="1.6" />
                            <circle cx="12" cy="19" r="1.6" />
                          </svg>
                        </button>
                        {openMenuId === product.id ? (
                          <div className="absolute right-0 z-20 mt-2 w-36 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                            {canCreate ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void duplicateProduct(product);
                                }}
                                className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Duplicate
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(product.reference);
                                setOpenMenuId(null);
                              }}
                              className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Copy Ref
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void removeProduct(product);
                              }}
                              className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="min-w-[840px] p-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      if (canCreate) {
                        router.push("/products/new");
                      }
                    }}
                    disabled={!canCreate}
                    className="rounded-[0.25rem] border border-slate-200 bg-white p-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)] disabled:cursor-default disabled:opacity-100"
                  >
                    <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <div className="relative h-40 w-full">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.product} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">No image</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[1.05rem] font-extrabold tracking-[-0.04em] text-blue-700">{product.reference}</div>
                        <div className="mt-4 text-[1rem] font-semibold text-slate-900">{product.product}</div>
                        <div className="mt-2 text-[0.9rem] text-slate-500">{product.category}</div>
                      </div>
                      <Badge status={product.status} />
                    </div>
                    <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
                      <span>{formatCurrency(product.salesPrice)}</span>
                      <span>{product.onHandQty.toFixed(2)}</span>
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

