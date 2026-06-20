export const PURCHASE_ORDERS_STORAGE_KEY = "oodo-erp.purchase-orders.v1";

export type PurchaseOrderStatus = "Draft" | "Confirmed" | "Received" | "Pending" | "Cancelled";

export type PurchaseOrderLine = {
  product: string;
  orderedQuantity: number;
  receivedQuantity: number;
  units: string;
  unitCost: number;
};

export type PurchaseOrderRecord = {
  id: string;
  reference: string;
  date: string;
  time: string;
  vendor: string;
  responsible: string;
  status: PurchaseOrderStatus;
  address: string;
  lines: PurchaseOrderLine[];
  grandTotal: number;
};

export type PurchaseOrderDraft = {
  vendor: string;
  responsible: string;
  address: string;
  date: string;
  lines: PurchaseOrderLine[];
  status: PurchaseOrderStatus;
};

const sampleVendors = [
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
];

const sampleOwners = [
  "Vijay Sharma",
  "John Dais",
  "Salman Sheikh",
  "Amit Sharma",
  "Neha Verma",
  "Ravi Patel",
];

const sampleStatuses: PurchaseOrderStatus[] = [
  "Confirmed",
  "Draft",
  "Pending",
  "Received",
  "Confirmed",
  "Pending",
  "Received",
  "Cancelled",
  "Confirmed",
  "Pending",
];

function padReference(index: number) {
  return `PO-${String(index).padStart(6, "0")}`;
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

function formatDisplayTime(index: number) {
  const hour = 9 + (index % 8);
  const minute = index % 2 === 0 ? "10" : "45";
  const period = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour > 12 ? hour - 12 : hour;
  return `${String(normalizedHour).padStart(2, "0")}:${minute} ${period}`;
}

function buildSampleLine(index: number): PurchaseOrderLine {
  const multiplier = 1 + (index % 4);
  return {
    product: ["Steel Sheets", "Fasteners", "Control Panels", "Packaging"][index % 4],
    orderedQuantity: multiplier,
    receivedQuantity: index % 3 === 0 ? multiplier : Math.max(0, multiplier - 1),
    units: "Nos",
    unitCost: [8200, 1400, 16500, 3200][index % 4],
  };
}

export function createSamplePurchaseOrders(): PurchaseOrderRecord[] {
  return Array.from({ length: 120 }, (_, index) => {
    const line = buildSampleLine(index);
    const lines = [line];
    const grandTotal = lines.reduce((sum, item) => sum + item.orderedQuantity * item.unitCost, 0);

    return {
      id: `purchase-order-${index + 1}`,
      reference: padReference(index + 1),
      date: formatDisplayDate(formatDateOffset(index)),
      time: formatDisplayTime(index),
      vendor: sampleVendors[index % sampleVendors.length],
      responsible: sampleOwners[index % sampleOwners.length],
      status: sampleStatuses[index % sampleStatuses.length],
      address: `${index + 40}, Industrial Estate, Chennai`,
      lines,
      grandTotal,
    };
  });
}

function createStorageKey() {
  return PURCHASE_ORDERS_STORAGE_KEY;
}

export function loadPurchaseOrders(): PurchaseOrderRecord[] {
  if (typeof window === "undefined") {
    return createSamplePurchaseOrders();
  }

  try {
    const raw = window.localStorage.getItem(createStorageKey());

    if (!raw) {
      return createSamplePurchaseOrders();
    }

    const parsed = JSON.parse(raw) as PurchaseOrderRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return createSamplePurchaseOrders();
    }

    return parsed;
  } catch {
    return createSamplePurchaseOrders();
  }
}

export function savePurchaseOrders(orders: PurchaseOrderRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(createStorageKey(), JSON.stringify(orders));
}

export function getNextPurchaseOrderReference(orders: PurchaseOrderRecord[]) {
  const highest = orders.reduce((max, order) => {
    const numeric = Number(order.reference.replace(/[^\d]/g, ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return padReference(highest + 1);
}

export function calculatePurchaseOrderTotal(lines: PurchaseOrderLine[]) {
  return lines.reduce((sum, item) => sum + item.orderedQuantity * item.unitCost, 0);
}

export function createPurchaseOrderRecord(draft: PurchaseOrderDraft, existingOrders: PurchaseOrderRecord[]): PurchaseOrderRecord {
  const now = new Date();
  const reference = getNextPurchaseOrderReference(existingOrders);
  const lines = draft.lines.length > 0 ? draft.lines : [buildSampleLine(existingOrders.length)];

  return {
    id: `purchase-order-${Date.now()}`,
    reference,
    date: new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${draft.date}T12:00:00`)),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(now),
    vendor: draft.vendor.trim(),
    responsible: draft.responsible.trim(),
    status: draft.status,
    address: draft.address.trim(),
    lines: lines.map((line) => ({ ...line })),
    grandTotal: calculatePurchaseOrderTotal(lines),
  };
}
