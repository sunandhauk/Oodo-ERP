export const BOMS_STORAGE_KEY = "oodo-erp.boms.v1";

export type BomStatus = "Active" | "Draft" | "Archived";

export type BomComponentLine = {
  component: string;
  availability: string;
  toConsumeUnits: number;
  consumeUnits: number;
};

export type BomWorkOrderLine = {
  operation: string;
  assignee: string;
  plannedHours: number;
  status: "Pending" | "Ready" | "In Progress" | "Done";
};

export type BomRecord = {
  id: string;
  reference: string;
  finishedProduct: string;
  quantity: number;
  unit: string;
  alternative: string;
  attachedLog: string;
  status: BomStatus;
  components: BomComponentLine[];
  workOrders: BomWorkOrderLine[];
  createdAt: string;
};

export type BomDraft = {
  finishedProduct: string;
  quantity: number;
  unit: string;
  alternative: string;
  reference: string;
  status: BomStatus;
  components: BomComponentLine[];
  workOrders: BomWorkOrderLine[];
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

const sampleAlternatives = ["Steel", "Aluminium", "Mild Steel", "Powder Coated", "Galvanized", "Premium"];

const sampleStatuses: BomStatus[] = [
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

function padReference(index: number) {
  return `BOM-${String(index).padStart(6, "0")}`;
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

function buildComponentLine(index: number): BomComponentLine {
  const amount = 1 + (index % 4);
  return {
    component: ["Aluminium Frame", "LED Strip", "Fastener Pack", "Power Board"][index % 4],
    availability: ["Available", "Not Available", "Reserved", "Available"][index % 4],
    toConsumeUnits: amount,
    consumeUnits: index % 3 === 0 ? amount : Math.max(0, amount - 1),
  };
}

function buildWorkOrderLine(index: number): BomWorkOrderLine {
  return {
    operation: ["Cutting", "Assembly", "Testing", "Packing"][index % 4],
    assignee: ["Amit Sharma", "Neha Verma", "Ravi Patel", "Meera Singh"][index % 4],
    plannedHours: [2, 3, 1.5, 2.5][index % 4],
    status: ["Pending", "Ready", "In Progress", "Done"][index % 4] as BomWorkOrderLine["status"],
  };
}

export function createSampleBoms(): BomRecord[] {
  return Array.from({ length: 120 }, (_, index) => {
    const components = [buildComponentLine(index)];
    const workOrders = [buildWorkOrderLine(index)];
    const createdAt = formatDisplayDate(formatDateOffset(index));

    return {
      id: `bom-${index + 1}`,
      reference: padReference(index + 1),
      finishedProduct: sampleProducts[index % sampleProducts.length],
      quantity: 1 + (index % 10),
      unit: "Units",
      alternative: sampleAlternatives[index % sampleAlternatives.length],
      attachedLog: `${padReference(index + 1)}.pdf`,
      status: sampleStatuses[index % sampleStatuses.length],
      components,
      workOrders,
      createdAt,
    };
  });
}

function createStorageKey() {
  return BOMS_STORAGE_KEY;
}

export function loadBoms(): BomRecord[] {
  void createStorageKey;
  return [];
}

export function saveBoms(boms: BomRecord[]) {
  void boms;
}

export function getNextBomReference(boms: BomRecord[]) {
  const highest = boms.reduce((max, bom) => {
    const numeric = Number(bom.reference.replace(/[^\d]/g, ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return padReference(highest + 1);
}

export function createBomRecord(draft: BomDraft, existingBoms: BomRecord[]): BomRecord {
  const reference = getNextBomReference(existingBoms);
  const attachedLog = `${reference}.pdf`;
  const components = draft.components.length > 0 ? draft.components : [buildComponentLine(existingBoms.length)];
  const workOrders = draft.workOrders.length > 0 ? draft.workOrders : [buildWorkOrderLine(existingBoms.length)];

  return {
    id: `bom-${Date.now()}`,
    reference,
    finishedProduct: draft.finishedProduct.trim(),
    quantity: draft.quantity,
    unit: draft.unit.trim() || "Units",
    alternative: draft.alternative.trim(),
    attachedLog,
    status: draft.status,
    components: components.map((component) => ({ ...component })),
    workOrders: workOrders.map((workOrder) => ({ ...workOrder })),
    createdAt: formatDisplayDate(new Date().toISOString().slice(0, 10)),
  };
}
