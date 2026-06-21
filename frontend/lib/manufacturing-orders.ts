export const MANUFACTURING_ORDERS_STORAGE_KEY = "oodo-erp.manufacturing-orders.v1";

export type ManufacturingOrderStatus = "Draft" | "Confirmed" | "In Progress" | "Done" | "Cancelled";

export type ManufacturingComponentLine = {
  component: string;
  availability: string;
  toConsumeUnits: number;
  consumeUnits: number;
  unitCost: number;
};

export type ManufacturingWorkOrderLine = {
  operation: string;
  assignee: string;
  plannedHours: number;
  realHours: number;
  status: "Pending" | "Ready" | "In Progress" | "Done";
};

export type ManufacturingOrderRecord = {
  id: string;
  reference: string;
  date: string;
  time: string;
  finishedProduct: string;
  assignee: string;
  status: ManufacturingOrderStatus;
  componentStatus: string;
  quantity: number;
  unit: string;
  scheduleDate: string;
  billOfMaterial: string;
  components: ManufacturingComponentLine[];
  workOrders: ManufacturingWorkOrderLine[];
  totalCost: number;
};

export type ManufacturingOrderDraft = {
  finishedProduct: string;
  assignee: string;
  quantity: number;
  unit: string;
  scheduleDate: string;
  billOfMaterial: string;
  status: ManufacturingOrderStatus;
  components: ManufacturingComponentLine[];
  workOrders: ManufacturingWorkOrderLine[];
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

const sampleAssignees = [
  "Amit Sharma",
  "Neha Verma",
  "Ravi Patel",
  "Meera Singh",
  "Vijay Kumar",
  "Salman Sheikh",
];

const sampleStatuses: ManufacturingOrderStatus[] = [
  "Confirmed",
  "Draft",
  "In Progress",
  "Done",
  "Confirmed",
  "In Progress",
  "Done",
  "Cancelled",
  "Draft",
  "Confirmed",
];

const sampleComponentStatus = [
  "Not Available",
  "Available",
  "Available",
  "Partial",
  "Available",
  "Not Available",
  "Reserved",
  "Available",
  "Partial",
  "Available",
];

function padReference(index: number) {
  return `MO-${String(index).padStart(6, "0")}`;
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
  const minute = index % 2 === 0 ? "20" : "45";
  const period = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour > 12 ? hour - 12 : hour;
  return `${String(normalizedHour).padStart(2, "0")}:${minute} ${period}`;
}

function buildComponentLine(index: number): ManufacturingComponentLine {
  const multiplier = 1 + (index % 4);
  return {
    component: ["Aluminium Frame", "LED Strip", "Fastener Pack", "Power Board"][index % 4],
    availability: ["Available", "Not Available", "Reserved", "Available"][index % 4],
    toConsumeUnits: multiplier,
    consumeUnits: index % 3 === 0 ? multiplier : Math.max(0, multiplier - 1),
    unitCost: [2400, 1800, 600, 4200][index % 4],
  };
}

function buildWorkOrderLine(index: number): ManufacturingWorkOrderLine {
  return {
    operation: ["Cutting", "Assembly", "Testing", "Packing"][index % 4],
    assignee: sampleAssignees[index % sampleAssignees.length],
    plannedHours: [2, 3, 1.5, 2.5][index % 4],
    realHours: 0,
    status: ["Pending", "Ready", "In Progress", "Done"][index % 4] as ManufacturingWorkOrderLine["status"],
  };
}

export function createSampleManufacturingOrders(): ManufacturingOrderRecord[] {
  return Array.from({ length: 120 }, (_, index) => {
    const components = [buildComponentLine(index)];
    const workOrders = [buildWorkOrderLine(index)];
    const totalCost = components.reduce((sum, item) => sum + item.consumeUnits * item.unitCost, 0);

    return {
      id: `manufacturing-order-${index + 1}`,
      reference: padReference(index + 1),
      date: formatDisplayDate(formatDateOffset(index)),
      time: formatDisplayTime(index),
      finishedProduct: sampleProducts[index % sampleProducts.length],
      assignee: sampleAssignees[index % sampleAssignees.length],
      status: sampleStatuses[index % sampleStatuses.length],
      componentStatus: sampleComponentStatus[index % sampleComponentStatus.length],
      quantity: 1 + (index % 10),
      unit: "Units",
      scheduleDate: formatDisplayDate(formatDateOffset(index - 2)),
      billOfMaterial: `BOM-${String(index + 1).padStart(4, "0")}`,
      components,
      workOrders,
      totalCost,
    };
  });
}

function createStorageKey() {
  return MANUFACTURING_ORDERS_STORAGE_KEY;
}

export function loadManufacturingOrders(): ManufacturingOrderRecord[] {
  void createStorageKey;
  return [];
}

export function saveManufacturingOrders(orders: ManufacturingOrderRecord[]) {
  void orders;
}

export function getNextManufacturingOrderReference(orders: ManufacturingOrderRecord[]) {
  const highest = orders.reduce((max, order) => {
    const numeric = Number(order.reference.replace(/[^\d]/g, ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return padReference(highest + 1);
}

export function calculateManufacturingOrderTotal(components: ManufacturingComponentLine[]) {
  return components.reduce((sum, item) => sum + item.consumeUnits * item.unitCost, 0);
}

export function createManufacturingOrderRecord(draft: ManufacturingOrderDraft, existingOrders: ManufacturingOrderRecord[]): ManufacturingOrderRecord {
  const now = new Date();
  const reference = getNextManufacturingOrderReference(existingOrders);
  const components = draft.components.length > 0 ? draft.components : [buildComponentLine(existingOrders.length)];
  const workOrders = draft.workOrders.length > 0 ? draft.workOrders : [buildWorkOrderLine(existingOrders.length)];

  return {
    id: `manufacturing-order-${Date.now()}`,
    reference,
    date: new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${draft.scheduleDate}T12:00:00`)),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(now),
    finishedProduct: draft.finishedProduct.trim(),
    assignee: draft.assignee.trim(),
    status: draft.status,
    componentStatus: draft.components.some((component) => component.availability.toLowerCase().includes("not")) ? "Not Available" : "Available",
    quantity: draft.quantity,
    unit: draft.unit.trim() || "Units",
    scheduleDate: new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${draft.scheduleDate}T12:00:00`)),
    billOfMaterial: draft.billOfMaterial.trim(),
    components: components.map((component) => ({ ...component })),
    workOrders: workOrders.map((workOrder) => ({ ...workOrder, realHours: workOrder.realHours ?? 0 })),
    totalCost: calculateManufacturingOrderTotal(components),
  };
}
