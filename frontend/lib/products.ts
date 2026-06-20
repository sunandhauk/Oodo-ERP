export const PRODUCTS_STORAGE_KEY = "oodo-erp.products.v1";

export type ProductStatus = "Active" | "Draft" | "Archived";

export type ProductRecord = {
  id: string;
  reference: string;
  product: string;
  salesPrice: number;
  costPrice: number;
  onHandQty: number;
  status: ProductStatus;
  category: string;
  description: string;
  createdAt: string;
  imageDataUrl?: string;
  procureOnDemand?: boolean;
  minimumQty?: number;
  freeToUseQty?: number;
  vendorOrItem?: string;
};

export type ProductDraft = {
  product: string;
  salesPrice: number;
  costPrice: number;
  onHandQty: number;
  category: string;
  description: string;
  status: ProductStatus;
  imageDataUrl?: string;
  procureOnDemand?: boolean;
  minimumQty?: number;
  freeToUseQty?: number;
  vendorOrItem?: string;
};

const sampleProducts = [
  "Door Frames",
  "Lighting Frame",
  "Control Cabinet",
  "Assembly Kit",
  "Panel Board",
  "Metal Shelf",
  "Routing Unit",
  "Packaging Tray",
  "Cable Harness",
  "Inspection Set",
];

const sampleStatuses: ProductStatus[] = [
  "Active",
  "Draft",
  "Active",
  "Active",
  "Draft",
  "Archived",
  "Active",
  "Draft",
  "Active",
  "Active",
];

const sampleCategories = ["Structure", "Electrical", "Metal Works", "Assembly", "Accessories", "Quality"];

function padReference(index: number) {
  return `PRD-${String(index).padStart(6, "0")}`;
}

function formatDateOffset(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function createSampleProducts(): ProductRecord[] {
  return Array.from({ length: 120 }, (_, index) => ({
    id: `product-${index + 1}`,
    reference: padReference(index + 1),
    product: sampleProducts[index % sampleProducts.length],
    salesPrice: [10, 15, 24, 35, 48, 60][index % 6],
    costPrice: [8, 11, 18, 27, 39, 49][index % 6],
    onHandQty: [50, 12, 18, 8, 92, 24][index % 6],
    status: sampleStatuses[index % sampleStatuses.length],
    category: sampleCategories[index % sampleCategories.length],
    description: `Premium ${sampleProducts[index % sampleProducts.length].toLowerCase()} for ERP workflows`,
    createdAt: formatDisplayDate(formatDateOffset(index)),
  }));
}

function createStorageKey() {
  return PRODUCTS_STORAGE_KEY;
}

export function loadProducts(): ProductRecord[] {
  if (typeof window === "undefined") {
    return createSampleProducts();
  }

  try {
    const raw = window.localStorage.getItem(createStorageKey());
    if (!raw) {
      return createSampleProducts();
    }

    const parsed = JSON.parse(raw) as ProductRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return createSampleProducts();
    }

    return parsed;
  } catch {
    return createSampleProducts();
  }
}

export function saveProducts(products: ProductRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(createStorageKey(), JSON.stringify(products));
}

export function getNextProductReference(products: ProductRecord[]) {
  const highest = products.reduce((max, product) => {
    const numeric = Number(product.reference.replace(/[^\d]/g, ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return padReference(highest + 1);
}

export function createProductRecord(draft: ProductDraft, existingProducts: ProductRecord[]): ProductRecord {
  return {
    id: `product-${Date.now()}`,
    reference: getNextProductReference(existingProducts),
    product: draft.product.trim(),
    salesPrice: draft.salesPrice,
    costPrice: draft.costPrice,
    onHandQty: draft.onHandQty,
    status: draft.status,
    category: draft.category.trim(),
    description: draft.description.trim(),
    createdAt: formatDisplayDate(new Date().toISOString().slice(0, 10)),
    imageDataUrl: draft.imageDataUrl,
    procureOnDemand: draft.procureOnDemand ?? false,
    minimumQty: draft.minimumQty ?? 0,
    freeToUseQty: draft.freeToUseQty ?? 0,
    vendorOrItem: draft.vendorOrItem?.trim() || "",
  };
}
