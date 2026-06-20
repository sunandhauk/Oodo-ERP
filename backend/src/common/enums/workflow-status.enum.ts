export enum DemandStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  Approved = 'approved',
  Rejected = 'rejected',
  Procured = 'procured',
  PartiallyFulfilled = 'partially_fulfilled',
  Fulfilled = 'fulfilled',
  Cancelled = 'cancelled',
}

export enum ProcurementStatus {
  Draft = 'draft',
  Ordered = 'ordered',
  PartiallyReceived = 'partially_received',
  Received = 'received',
  Cancelled = 'cancelled',
}

export enum FulfillmentStatus {
  Planned = 'planned',
  Picked = 'picked',
  Dispatched = 'dispatched',
  Delivered = 'delivered',
  Closed = 'closed',
  Cancelled = 'cancelled',
}

export enum InventoryMovementType {
  Receipt = 'receipt',
  Reservation = 'reservation',
  Issue = 'issue',
  Adjustment = 'adjustment',
  Return = 'return',
}
