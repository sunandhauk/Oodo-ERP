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
  imageUrl?: string;
  procureOnDemand?: boolean;
  procureSource?: "purchase" | "manufacturing";
  minimumQty?: number;
  freeToUseQty?: number;
  vendorName?: string;
  bomReference?: string;
};

export type ProductDraft = {
  product: string;
  salesPrice: number;
  costPrice: number;
  onHandQty: number;
  category: string;
  description: string;
  status: ProductStatus;
  imageUrl?: string;
  procureOnDemand?: boolean;
  procureSource?: "purchase" | "manufacturing";
  minimumQty?: number;
  freeToUseQty?: number;
  vendorName?: string;
  bomReference?: string;
};

function padReference(index: number) {
  return `PRD-${String(index).padStart(6, "0")}`;
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
    createdAt: new Date().toISOString(),
    imageUrl: draft.imageUrl,
    procureOnDemand: draft.procureOnDemand ?? false,
    procureSource: draft.procureSource,
    minimumQty: draft.minimumQty ?? 0,
    freeToUseQty: draft.freeToUseQty ?? 0,
    vendorName: draft.vendorName?.trim() || "",
    bomReference: draft.bomReference?.trim() || "",
  };
}
