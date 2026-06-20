import { BadRequestException } from '@nestjs/common';
import { assertDemandTransition, assertFulfillmentTransition, assertProcurementTransition } from '../src/common/workflow/workflow-transition.util';
import { DemandStatus, FulfillmentStatus, ProcurementStatus } from '../src/common/enums/workflow-status.enum';

describe('workflow transitions', () => {
  it('allows a valid demand transition', () => {
    expect(() => assertDemandTransition(DemandStatus.Submitted, DemandStatus.Approved)).not.toThrow();
  });

  it('rejects an invalid procurement transition', () => {
    expect(() => assertProcurementTransition(ProcurementStatus.Draft, ProcurementStatus.Received)).toThrow(
      BadRequestException,
    );
  });

  it('rejects an invalid fulfillment transition', () => {
    expect(() => assertFulfillmentTransition(FulfillmentStatus.Planned, FulfillmentStatus.Delivered)).toThrow(
      BadRequestException,
    );
  });
});
