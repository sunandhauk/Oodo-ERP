"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuditLog } from "@/components/audit-log-provider";
import { useProducts } from "@/components/products-store";
import type { ProductDraft } from "@/lib/products";

function SectionCard({ children }: { children: ReactNode }) {
  return <section className="rounded-[24px] border border-slate-200 bg-white shadow-[0_16px_38px_rgba(15,23,42,0.05)]">{children}</section>;
}

export function ProductCreateContent() {
  const router = useRouter();
  const { appendAuditLog } = useAuditLog();
  const { createProduct } = useProducts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>({
    product: "",
    salesPrice: 0,
    costPrice: 0,
    onHandQty: 0,
    category: "",
    description: "",
    status: "Draft",
    imageDataUrl: "",
    procureOnDemand: false,
    minimumQty: 0,
    freeToUseQty: 0,
    vendorOrItem: "",
  });

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

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

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setDraft((current) => ({ ...current, imageDataUrl: result }));
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
    };
    reader.readAsDataURL(file);
  }

  function submit() {
    setSaving(true);
    try {
      const next = createProduct(draft);
      appendAuditLog({
        user: "Admin",
        module: "Products",
        recordType: "Product",
        recordId: next.reference,
        action: "Created",
        fieldChanged: "Order",
        oldValue: "Draft",
        newValue: next.status,
        details: `Created product ${next.reference}`,
      });
      router.replace("/products");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start justify-between gap-4 animate-fade-up">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <span>Home</span>
            <span className="text-slate-300">/</span>
            <span>Products</span>
            <span className="text-slate-300">/</span>
            <span className="text-blue-600">Create</span>
          </div>
          <h1 className="mt-2 text-[1.65rem] font-extrabold tracking-[-0.04em] text-slate-900 sm:text-[1.9rem]">Product - Create</h1>
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div>
            <div className="text-[0.98rem] font-extrabold tracking-[-0.03em] text-slate-900">Product - Create</div>
            <div className="mt-1 text-xs font-medium text-slate-500">Auto generate reference when saved.</div>
          </div>
          <div className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">Auto Generate</div>
        </div>

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
                <div className="flex items-center border-r border-slate-200 px-4 text-sm font-semibold text-slate-500">₹</div>
                <input
                  type="number"
                  min="0"
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
                <div className="flex items-center border-r border-slate-200 px-4 text-sm font-semibold text-slate-500">₹</div>
                <input
                  type="number"
                  min="0"
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
                min="0"
                value={draft.freeToUseQty ?? 0}
                onChange={(event) => setDraft((current) => ({ ...current, freeToUseQty: Number(event.target.value) }))}
                placeholder="Enter free to use quantity"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-300 focus:bg-slate-50"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Product Image</label>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex min-h-[226px] w-full items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-center transition hover:border-brand-300 hover:bg-brand-50/50"
              >
                {draft.imageDataUrl ? (
                  <div className="flex w-full flex-col items-center justify-center gap-3">
                    <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <Image src={draft.imageDataUrl} alt="Uploaded product preview" fill sizes="112px" className="object-cover" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Change Image</div>
                      <div className="mt-1 text-xs text-slate-500">JPG, PNG or WebP (Max. 2MB)</div>
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
              </button>
            </div>

            <div className="space-y-2 rounded-[22px] border border-slate-200 bg-white p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={Boolean(draft.procureOnDemand)}
                  onChange={(event) => setDraft((current) => ({ ...current, procureOnDemand: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                Procure on Demand
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[0.65rem] font-bold text-slate-500">i</span>
              </label>
              <input
                type="number"
                min="0"
                value={draft.minimumQty ?? 0}
                onChange={(event) => setDraft((current) => ({ ...current, minimumQty: Number(event.target.value) }))}
                placeholder="Enter minimum qty"
                disabled={!draft.procureOnDemand}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50 focus:border-slate-300 focus:bg-slate-50"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-600">Vendor / Item</label>
              <input
                value={draft.vendorOrItem ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, vendorOrItem: event.target.value }))}
                placeholder="Enter vendor or item"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-300 focus:bg-slate-50"
              />
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
