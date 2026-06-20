import { BadRequestException } from '@nestjs/common';
import { DemandStatus, FulfillmentStatus, ProcurementStatus } from '../enums/workflow-status.enum';

const ensureAllowed = (entity: string, current: string, next: string, allowed: string[]) => {
  if (!allowed.includes(next)) {
    throw new BadRequestException(`${entity} cannot transition from ${current} to ${next}.`);
  }
};

export const assertDemandTransition = (current: string, next: DemandStatus) => {
  switch (current) {
    case DemandStatus.Draft:
      ensureAllowed('Demand', current, next, [DemandStatus.Submitted, DemandStatus.Cancelled]);
      break;
    case DemandStatus.Submitted:
      ensureAllowed('Demand', current, next, [DemandStatus.Approved, DemandStatus.Rejected, DemandStatus.Cancelled]);
      break;
    case DemandStatus.Approved:
      ensureAllowed('Demand', current, next, [DemandStatus.Procured, DemandStatus.Cancelled]);
      break;
    case DemandStatus.Procured:
      ensureAllowed('Demand', current, next, [DemandStatus.PartiallyFulfilled, DemandStatus.Fulfilled]);
      break;
    case DemandStatus.PartiallyFulfilled:
      ensureAllowed('Demand', current, next, [DemandStatus.Fulfilled, DemandStatus.Cancelled]);
      break;
    case DemandStatus.Fulfilled:
    case DemandStatus.Rejected:
    case DemandStatus.Cancelled:
      ensureAllowed('Demand', current, next, [current as DemandStatus]);
      break;
    default:
      throw new BadRequestException(`Unknown demand status: ${current}`);
  }
};

export const assertProcurementTransition = (current: string, next: ProcurementStatus) => {
  switch (current) {
    case ProcurementStatus.Draft:
      ensureAllowed('Procurement', current, next, [ProcurementStatus.Ordered, ProcurementStatus.Cancelled]);
      break;
    case ProcurementStatus.Ordered:
      ensureAllowed('Procurement', current, next, [
        ProcurementStatus.PartiallyReceived,
        ProcurementStatus.Received,
        ProcurementStatus.Cancelled,
      ]);
      break;
    case ProcurementStatus.PartiallyReceived:
      ensureAllowed('Procurement', current, next, [ProcurementStatus.Received, ProcurementStatus.Cancelled]);
      break;
    case ProcurementStatus.Received:
    case ProcurementStatus.Cancelled:
      ensureAllowed('Procurement', current, next, [current as ProcurementStatus]);
      break;
    default:
      throw new BadRequestException(`Unknown procurement status: ${current}`);
  }
};

export const assertFulfillmentTransition = (current: string, next: FulfillmentStatus) => {
  switch (current) {
    case FulfillmentStatus.Planned:
      ensureAllowed('Fulfillment', current, next, [
        FulfillmentStatus.Picked,
        FulfillmentStatus.Dispatched,
        FulfillmentStatus.Cancelled,
      ]);
      break;
    case FulfillmentStatus.Picked:
      ensureAllowed('Fulfillment', current, next, [
        FulfillmentStatus.Dispatched,
        FulfillmentStatus.Cancelled,
      ]);
      break;
    case FulfillmentStatus.Dispatched:
      ensureAllowed('Fulfillment', current, next, [FulfillmentStatus.Delivered, FulfillmentStatus.Cancelled]);
      break;
    case FulfillmentStatus.Delivered:
      ensureAllowed('Fulfillment', current, next, [FulfillmentStatus.Closed]);
      break;
    case FulfillmentStatus.Closed:
    case FulfillmentStatus.Cancelled:
      ensureAllowed('Fulfillment', current, next, [current as FulfillmentStatus]);
      break;
    default:
      throw new BadRequestException(`Unknown fulfillment status: ${current}`);
  }
};
