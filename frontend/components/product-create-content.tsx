"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useAuditLog } from "@/components/audit-log-provider";
import { useProducts } from "@/components/products-store";
import type { ProductDraft } from "@/lib/products";

type VendorOption = {
  value: string;
  label: string;
};

type BomOption = {
  reference: string;
  finishedProduct: string;
};

type ProcurementRecord = {
  vendor?: string;
  responsible?: string;
};

type SalesOrderLookup = {
  status: string;
  lines: Array<{
    product: string;
    orderedQuantity: number;
    deliveredQuantity: number;
  }>;
};

type ManufacturingOrderLookup = {
  status: string;
  finishedProduct: string;
  quantity: number;
  components: Array<{
    component: string;
    toConsumeUnits: number;
    consumeUnits: number;
  }>;
};

function SectionCard({ children }: { children: ReactNode }) {
  return <section className="rounded-[0.25rem] border border-slate-200 bg-white shadow-[0_16px_38px_rgba(15,23,42,0.05)]">{children}</section>;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function sumSalesReservations(productName: string, orders: SalesOrderLookup[]) {
  const target = normalize(productName);
  if (!target) {
    return 0;
  }

  return orders.reduce((sum, order) => {
    if (normalize(order.status) === "delivered") {
      return sum;
    }

    const lineReservations = order.lines.reduce((lineSum, line) => {
      if (normalize(line.product) !== target) {
        return lineSum;
      }

      return lineSum + Math.max(0, Number(line.orderedQuantity || 0) - Number(line.deliveredQuantity || 0));
    }, 0);

    return sum + lineReservations;
  }, 0);
}

function sumManufacturingReservations(productName: string, orders: ManufacturingOrderLookup[]) {
  const target = normalize(productName);
  if (!target) {
    return 0;
  }

  return orders.reduce((sum, order) => {
    if (normalize(order.status) === "done") {
      return sum;
    }

    const componentReservations = order.components.reduce((componentSum, component) => {
      if (normalize(component.component) !== target) {
        return componentSum;
      }

      return componentSum + Math.max(0, Number(component.toConsumeUnits || 0) - Number(component.consumeUnits || 0));
    }, 0);

    return sum + componentReservations;
  }, 0);
}

export function ProductCreateContent() {
  const router = useRouter();
  const { appendAuditLog } = useAuditLog();
  const { createProduct } = useProducts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputId = useId();
  const imageUploadPromiseRef = useRef<Promise<string> | null>(null);
  const imageUploadTokenRef = useRef(0);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [bomOptions, setBomOptions] = useState<BomOption[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrderLookup[]>([]);
  const [manufacturingOrders, setManufacturingOrders] = useState<ManufacturingOrderLookup[]>([]);
  const [draft, setDraft] = useState<ProductDraft>({
    product: "",
    salesPrice: 0,
    costPrice: 0,
    onHandQty: 0,
    category: "General",
    description: "",
    status: "Draft",
    imageUrl: "",
    procureOnDemand: false,
    procureSource: undefined,
    minimumQty: 0,
    freeToUseQty: 0,
    vendorName: "",
    bomReference: "",
  });

  useEffect(() => {
    return () => {
      if (imagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    let active = true;

    async function loadLookups() {
      try {
        const [procurementsResponse, bomResponse, salesResponse, manufacturingResponse] = await Promise.all([
          fetch("/api/procurements", { cache: "no-store" }),
          fetch("/api/bills-of-materials", { cache: "no-store" }),
          fetch("/api/sales-orders", { cache: "no-store" }),
          fetch("/api/manufacturing-orders", { cache: "no-store" }),
        ]);

        const procurementsPayload = (await procurementsResponse.json().catch(() => null)) as { data?: ProcurementRecord[] } | null;
        const bomPayload = (await bomResponse.json().catch(() => null)) as { data?: BomOption[] } | null;
        const salesPayload = (await salesResponse.json().catch(() => null)) as { data?: SalesOrderLookup[] } | null;
        const manufacturingPayload = (await manufacturingResponse.json().catch(() => null)) as { data?: ManufacturingOrderLookup[] } | null;

        if (!active) {
          return;
        }

        const vendors = Array.from(
          new Set(
            (procurementsPayload?.data || [])
              .map((record) => record.vendor?.trim() || record.responsible?.trim() || "")
              .filter(Boolean),
          ),
        ).map((value) => ({ value, label: value }));
        const boms = (bomPayload?.data || [])
          .map((record) => ({
            reference: record.reference,
            finishedProduct: record.finishedProduct,
          }))
          .filter((record) => Boolean(record.reference));

        setVendorOptions(vendors);
        setBomOptions(boms);
        setSalesOrders(salesPayload?.data || []);
        setManufacturingOrders(manufacturingPayload?.data || []);
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

  const reservedQty = useMemo(() => {
    return sumSalesReservations(draft.product, salesOrders) + sumManufacturingReservations(draft.product, manufacturingOrders);
  }, [draft.product, manufacturingOrders, salesOrders]);

  const freeToUseQty = useMemo(() => {
    return Math.max(0, Number(draft.onHandQty || 0) - reservedQty);
  }, [draft.onHandQty, reservedQty]);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    const uploadToken = ++imageUploadTokenRef.current;
    setErrorMessage("");
    setSelectedImageFile(file);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      appendAuditLog({
        user: "Admin",
        module: "Products",
        recordType: "Product",
        recordId: "upload",
        action: "Updated",
        fieldChanged: "Image upload",
        oldValue: file.name,
        newValue: "-",
        details: "Only JPG, PNG, or WebP images up to 2MB are allowed",
      });
      return;
    }

    setImageUploading(true);
    setDraft((current) => ({ ...current, imageUrl: "" }));
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl((current) => {
      if (current.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return previewUrl;
    });
    const uploadPromise = (async () => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as { status?: string; data?: { publicUrl?: string }; error?: { message?: string } | string } | null;
      const publicUrl = payload?.data?.publicUrl;
      if (!response.ok || payload?.status !== "success" || !publicUrl) {
        throw new Error(typeof payload?.error === "string" ? payload.error : payload?.error?.message || "Unable to upload product image.");
      }

      return publicUrl;
    })();

    imageUploadPromiseRef.current = uploadPromise;

    uploadPromise
      .then((publicUrl) => {
        if (imageUploadTokenRef.current !== uploadToken) {
          return;
        }

        setDraft((current) => ({ ...current, imageUrl: publicUrl }));
        appendAuditLog({
          user: "Admin",
          module: "Products",
          recordType: "Product",
          recordId: "upload",
          action: "Updated",
          fieldChanged: "Image",
          oldValue: "-",
          newValue: file.name,
          details: `Uploaded product image ${file.name}`,
        });
      })
      .catch((error) => {
        if (imageUploadTokenRef.current !== uploadToken) {
          return;
        }

        setDraft((current) => ({ ...current, imageUrl: "" }));
        setErrorMessage(error instanceof Error ? error.message : "Unable to upload product image.");
      })
      .finally(() => {
        if (imageUploadTokenRef.current === uploadToken) {
          setImageUploading(false);
        }
      });
  }

  function updateProcureSource(nextSource: "purchase" | "manufacturing" | "") {
    setDraft((current) => ({
      ...current,
      procureSource: nextSource || undefined,
      vendorName: nextSource === "purchase" ? current.vendorName : "",
      bomReference: nextSource === "manufacturing" ? current.bomReference : "",
    }));
  }

  async function submit() {
    setSaving(true);
    setErrorMessage("");
    try {
      if (draft.procureOnDemand && !draft.procureSource) {
        throw new Error("Please choose Purchase or Manufacturing for Procure on Demand.");
      }
      if (draft.procureOnDemand && draft.procureSource === "purchase" && !draft.vendorName) {
        throw new Error("Please choose a vendor.");
      }
      if (draft.procureOnDemand && draft.procureSource === "manufacturing" && !draft.bomReference) {
        throw new Error("Please choose a bill of materials.");
      }
      if (imageUploading) {
        throw new Error("Please wait for the image upload to finish.");
      }

      let imageUrl = draft.imageUrl;
      if (!imageUrl && selectedImageFile) {
        imageUrl = imageUploadPromiseRef.current
          ? await imageUploadPromiseRef.current
          : await (async () => {
              const formData = new FormData();
              formData.append("file", selectedImageFile);

              const response = await fetch("/api/files/upload", {
                method: "POST",
                body: formData,
                credentials: "include",
              });
              const payload = (await response.json().catch(() => null)) as { status?: string; data?: { publicUrl?: string }; error?: { message?: string } | string } | null;
              const publicUrl = payload?.data?.publicUrl;
              if (!response.ok || payload?.status !== "success" || !publicUrl) {
                throw new Error(typeof payload?.error === "string" ? payload.error : payload?.error?.message || "Unable to upload product image.");
              }

              return publicUrl;
            })();
        setDraft((current) => ({ ...current, imageUrl }));
      }

      const next = await createProduct({
        ...draft,
        imageUrl,
        freeToUseQty,
      });

      appendAuditLog({
        user: "Admin",
        module: "Products",
        recordType: "Product",
        recordId: next.reference,
        action: "Created",
        fieldChanged: "Product setup",
        oldValue: "-",
        newValue: next.reference,
        details: `Created product ${next.reference} with procurement setup ${draft.procureOnDemand ? draft.procureSource || "enabled" : "disabled"}`,
      });
      router.replace("/products");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start justify-between gap-4 animate-fade-up">
        <div>
          <Breadcrumbs items={[{ label: "Home", href: "/dashboard" }, { label: "Products", href: "/products" }, { label: "Create" }]} />
          <h1 className="mt-2 text-[1.65rem] font-extrabold tracking-[-0.04em] text-slate-900 sm:text-[1.9rem]">Product - Create</h1>
          <p className="mt-1 text-sm text-slate-500">Create product master data, price it, and configure procurement behavior.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/audit-logs")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Logs
          </button>
          <button
            type="button"
            onClick={() => router.push("/products")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Save
          </button>
        </div>
      </section>

      <SectionCard>
        <div className="grid gap-4 p-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-600">Product *</label>
              <input
                value={draft.product}
                onChange={(event) => setDraft((current) => ({ ...current, product: event.target.value }))}
                placeholder="Enter product name"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-300 focus:bg-slate-50"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Sales Price *</label>
              <div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center border-r border-slate-200 px-4 text-sm font-semibold text-slate-500">INR</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.salesPrice}
                  onChange={(event) => setDraft((current) => ({ ...current, salesPrice: Number(event.target.value) }))}
                  placeholder="Enter sales price"
                  className="h-11 min-w-0 flex-1 px-4 text-sm font-medium text-slate-900 outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Cost Price *</label>
              <div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center border-r border-slate-200 px-4 text-sm font-semibold text-slate-500">INR</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.costPrice}
                  onChange={(event) => setDraft((current) => ({ ...current, costPrice: Number(event.target.value) }))}
                  placeholder="Enter cost price"
                  className="h-11 min-w-0 flex-1 px-4 text-sm font-medium text-slate-900 outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">On Hand Qty</label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={draft.onHandQty}
                onChange={(event) => setDraft((current) => ({ ...current, onHandQty: Number(event.target.value) }))}
                placeholder="Enter on hand quantity"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-300 focus:bg-slate-50"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Free to Use Qty</label>
              <input
                type="number"
                value={freeToUseQty.toFixed(3)}
                readOnly
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-900 outline-none"
              />
              <p className="text-xs text-slate-500">Computed from on hand minus reserved quantities from open sales and manufacturing orders.</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={Boolean(draft.procureOnDemand)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setDraft((current) => ({
                      ...current,
                      procureOnDemand: checked,
                      procureSource: checked ? current.procureSource || "purchase" : undefined,
                      vendorName: checked ? current.vendorName : "",
                      bomReference: checked ? current.bomReference : "",
                    }));
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                Procure on Demand
              </label>
              <p className="text-xs text-slate-500">When enabled, the product can trigger a purchase order or manufacturing order for short stock.</p>
            </div>

            {draft.procureOnDemand ? (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-600">Procure via *</label>
                  <select
                    value={draft.procureSource || ""}
                    onChange={(event) => updateProcureSource(event.target.value as "purchase" | "manufacturing" | "")}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-300 focus:bg-slate-50"
                  >
                    <option value="">Select source</option>
                    <option value="purchase">Purchase</option>
                    <option value="manufacturing">Manufacturing</option>
                  </select>
                </div>

                {draft.procureSource === "purchase" ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-600">Vendor *</label>
                    <select
                      value={draft.vendorName || ""}
                      onChange={(event) => setDraft((current) => ({ ...current, vendorName: event.target.value }))}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-300 focus:bg-slate-50"
                      disabled={loadingLookups}
                    >
                      <option value="">{loadingLookups ? "Loading vendors..." : "Select vendor"}</option>
                      {vendorOptions.map((vendor) => (
                        <option key={vendor.value} value={vendor.value}>
                          {vendor.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {draft.procureSource === "manufacturing" ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-600">BoM *</label>
                    <select
                      value={draft.bomReference || ""}
                      onChange={(event) => setDraft((current) => ({ ...current, bomReference: event.target.value }))}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-300 focus:bg-slate-50"
                      disabled={loadingLookups}
                    >
                      <option value="">{loadingLookups ? "Loading bills of materials..." : "Select bill of materials"}</option>
                      {bomOptions.map((bom) => (
                        <option key={bom.reference} value={bom.reference}>
                          {bom.reference} - {bom.finishedProduct}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="block text-sm font-semibold text-slate-600">Product Image</div>
              <input
                id={imageInputId}
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleImageChange}
              />
              <label
                htmlFor={imageInputId}
                className="group relative flex min-h-[226px] w-full items-center justify-center rounded-[0.25rem] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-center transition hover:border-brand-300 hover:bg-brand-50/50"
              >
                {imagePreviewUrl ? (
                  <div className="flex w-full flex-col items-center justify-center gap-3">
                    <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <img src={imagePreviewUrl} alt="Uploaded product preview" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Change Image</div>
                      <div className="mt-1 text-xs text-slate-500">{imageUploading ? "Uploading..." : draft.imageUrl ? "Image uploaded" : "JPG, PNG or WebP (Max. 2MB)"}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-600">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
                      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="14" rx="3" />
                        <circle cx="9" cy="9" r="1.5" />
                        <path d="m5 16 4.5-4.5 3 3 3-3L19 16" />
                        <path d="M15 19h4" />
                        <path d="M17 17v4" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Upload Image</div>
                      <div className="mt-1 text-xs text-slate-500">JPG, PNG or WebP (Max. 2MB)</div>
                    </div>
                  </div>
                )}
                <span className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition group-hover:text-brand-600">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z" />
                    <path d="m13.5 6.5 4 4" />
                  </svg>
                </span>
              </label>
            </div>

            {errorMessage ? (
              <div className="rounded-[0.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{errorMessage}</div>
            ) : null}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
