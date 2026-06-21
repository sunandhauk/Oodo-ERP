export const SALES_ORDERS_STORAGE_KEY = "oodo-erp.sales-orders.v2";

export type SalesOrderStatus =
  | "Draft"
  | "Confirmed"
  | "Partially Delivered"
  | "Fully Delivered"
  | "Pending"
  | "Delivered"
  | "Cancelled";

export type SalesOrderLine = {
  product: string;
  availability: string;
  orderedQuantity: number;
  deliveredQuantity: number;
  units: string;
  unitPrice: number;
};

export type SalesOrderRecord = {
  id: string;
  reference: string;
  date: string;
  time: string;
  customer: string;
  salesperson: string;
  status: SalesOrderStatus;
  address: string;
  lines: SalesOrderLine[];
  grandTotal: number;
};

export type SalesOrderDraft = {
  customer: string;
  salesperson: string;
  address: string;
  date: string;
  lines: SalesOrderLine[];
  status: SalesOrderStatus;
};

const sampleCustomers = [
  "Suzuki India",
  "NRF Ltd.",
  "Tata Motors",
  "Reliance Retail",
  "Infosys Limited",
  "Mahindra & Mahindra",
  "HDFC Bank",
  "ICICI Bank",
  "Larsen & Toubro",
  "Adani Enterprises",
];

export const SALES_ORDER_CUSTOMERS = sampleCustomers;

const sampleSalespeople = [
  "Ravi Jadeja",
  "Salman Sheikh",
  "Amit Sharma",
  "Neha Verma",
  "Ravi Patel",
  "Meera Singh",
];

const sampleStatuses: SalesOrderStatus[] = [
  "Confirmed",
  "Partially Delivered",
  "Pending",
  "Confirmed",
  "Pending",
  "Fully Delivered",
  "Confirmed",
  "Cancelled",
  "Pending",
  "Confirmed",
];

function isDeliveredStatus(status: SalesOrderStatus) {
  return status === "Partially Delivered" || status === "Delivered" || status === "Fully Delivered";
}

function padReference(index: number) {
  return `SO-${String(index).padStart(6, "0")}`;
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
  const hour = 8 + (index % 8);
  const minute = index % 2 === 0 ? "15" : "45";
  const period = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour > 12 ? hour - 12 : hour;
  return `${String(normalizedHour).padStart(2, "0")}:${minute} ${period}`;
}

function buildSampleLine(index: number): SalesOrderLine {
  const multiplier = 1 + (index % 4);
  return {
    product: ["ERP License", "Warehouse Scanner", "Delivery Kit", "Support Plan"][index % 4],
    availability: ["In Stock", "Limited", "Reserved", "In Stock"][index % 4],
    orderedQuantity: multiplier,
    deliveredQuantity: index % 3 === 0 ? multiplier : Math.max(0, multiplier - 1),
    units: "Nos",
    unitPrice: [12000, 4500, 2200, 8500][index % 4],
  };
}

export function createSampleSalesOrders(): SalesOrderRecord[] {
  return Array.from({ length: 120 }, (_, index) => {
    const line = buildSampleLine(index);
    const lines = [line];
    const status = sampleStatuses[index % sampleStatuses.length];
    const grandTotal = calculateSalesOrderTotal(lines, status);

    return {
      id: `sales-order-${index + 1}`,
      reference: padReference(index + 1),
      date: formatDisplayDate(formatDateOffset(index)),
      time: formatDisplayTime(index),
      customer: sampleCustomers[index % sampleCustomers.length],
      salesperson: sampleSalespeople[index % sampleSalespeople.length],
      status,
      address: `${index + 12}, ERP Avenue, Chennai`,
      lines,
      grandTotal,
    };
  });
}

function createStorageKey() {
  return SALES_ORDERS_STORAGE_KEY;
}

export function loadSalesOrders(): SalesOrderRecord[] {
  void createStorageKey;
  return [];
}

export function saveSalesOrders(orders: SalesOrderRecord[]) {
  void orders;
}

export function formatSalesOrderDateTime(date: string, time: string) {
  return `${date} ${time}`;
}

export function getNextSalesOrderReference(orders: SalesOrderRecord[]) {
  const highest = orders.reduce((max, order) => {
    const numeric = Number(order.reference.replace(/[^\d]/g, ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return padReference(highest + 1);
}

export function calculateSalesOrderTotal(lines: SalesOrderLine[], status: SalesOrderStatus = "Draft") {
  const useDeliveredQuantity = isDeliveredStatus(status);

  return lines.reduce(
    (sum, item) => sum + (useDeliveredQuantity ? item.deliveredQuantity : item.orderedQuantity) * item.unitPrice,
    0,
  );
}

export function createSalesOrderRecord(draft: SalesOrderDraft, existingOrders: SalesOrderRecord[]): SalesOrderRecord {
  const now = new Date();
  const reference = getNextSalesOrderReference(existingOrders);
  const lines = draft.lines.length > 0 ? draft.lines : [buildSampleLine(existingOrders.length)];

  return {
    id: `sales-order-${Date.now()}`,
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
    customer: draft.customer.trim(),
    salesperson: draft.salesperson.trim(),
    status: draft.status,
    address: draft.address.trim(),
    lines: lines.map((line) => ({ ...line })),
    grandTotal: calculateSalesOrderTotal(lines, draft.status),
  };
}

