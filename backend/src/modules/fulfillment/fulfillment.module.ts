import { Body, Controller, Module, Param, Post } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { assertFulfillmentTransition } from '../../common/workflow/workflow-transition.util';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { FulfillmentStatus, InventoryMovementType } from '../../common/enums/workflow-status.enum';
import { CreateFulfillmentDto, DeliverFulfillmentDto, DispatchFulfillmentDto } from './fulfillment.dto';

@Controller('fulfillments')
export class FulfillmentController {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post('from-demand/:demandId')
  @Permissions('manufacturing.production-entry')
  async createFromDemand(
    @Param('demandId') demandId: string,
    @Body() dto: CreateFulfillmentDto,
    @CurrentUser() actor: { id: string } | null,
  ) {
    const tenantId = this.requestContext.getTenantId();
    const fulfillment = await this.database.queryOne<{ id: string; fulfillment_no: string }>(
      `insert into app_fulfillments (tenant_id, demand_id, fulfillment_no, status, delivery_address)
       values ($1, $2, $3, $4, $5)
       returning id, fulfillment_no`,
      [tenantId, demandId, `FUL-${Date.now()}`, FulfillmentStatus.Planned, dto.deliveryAddress || null],
    );
    if (!fulfillment) throw new Error('Unable to create fulfillment');
    const demandLines = await this.database.query<{ product_id: string; quantity: string }>(
      `select product_id, quantity from app_demand_lines where demand_id = $1`,
      [demandId],
    );
    for (const line of demandLines) {
      await this.database.query(
        `insert into app_fulfillment_lines (fulfillment_id, product_id, quantity)
         values ($1, $2, $3)`,
        [fulfillment.id, line.product_id, line.quantity],
      );
    }
    await this.database.query(
      `update app_demands set current_step = $2 where id = $1`,
      [demandId, 'fulfillment-created'],
    );
    await this.database.insertAuditLog({
      tenantId,
      actorUserId: actor?.id || null,
      entityType: 'fulfillment',
      entityId: fulfillment.id,
      action: 'created-from-demand',
      afterData: { demandId, deliveryAddress: dto.deliveryAddress || null },
    });
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: fulfillment,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/dispatch')
  @Permissions('fulfillment.manage')
  async dispatch(
    @Param('id') id: string,
    @CurrentUser() user: { id: string } | null,
    @Body() _dto: DispatchFulfillmentDto,
  ) {
    const tenantId = this.requestContext.getTenantId();
    const current = await this.database.queryOne<{ status: string }>(
      `select status from app_fulfillments where id = $1 limit 1`,
      [id],
    );
    assertFulfillmentTransition(current?.status || FulfillmentStatus.Planned, FulfillmentStatus.Dispatched);
    const fulfillment = await this.database.queryOne<{ demand_id: string }>(
      `select demand_id from app_fulfillments where id = $1 limit 1`,
      [id],
    );
    await this.database.query(
      `update app_fulfillments set status = $2, shipped_at = now(), updated_at = now() where id = $1`,
      [id, FulfillmentStatus.Dispatched],
    );
    const lines = await this.database.query<{ product_id: string; quantity: string }>(
      `select product_id, quantity from app_fulfillment_lines where fulfillment_id = $1`,
      [id],
    );
    for (const line of lines) {
      await this.database.query(
        `insert into app_inventory_movements (
          tenant_id, product_id, movement_type, quantity, reference_type, reference_id, created_by
        ) values ($1, $2, $3, $4, $5, $6, $7)`,
        [tenantId, line.product_id, InventoryMovementType.Issue, line.quantity, 'fulfillment', id, user?.id || null],
      );
    }
    if (fulfillment?.demand_id) {
      await this.database.query(`update app_demands set current_step = $2 where id = $1`, [
        fulfillment.demand_id,
        'dispatched',
      ]);
    }
    await this.database.insertAuditLog({
      tenantId,
      actorUserId: user?.id || null,
      entityType: 'fulfillment',
      entityId: id,
      action: 'dispatched',
      afterData: { status: FulfillmentStatus.Dispatched },
    });
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: { fulfillmentId: id, status: FulfillmentStatus.Dispatched },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/deliver')
  @Permissions('fulfillment.manage')
  async deliver(@Param('id') id: string, @Body() _dto: DeliverFulfillmentDto, @CurrentUser() user: { id: string } | null) {
    const current = await this.database.queryOne<{ status: string }>(
      `select status from app_fulfillments where id = $1 limit 1`,
      [id],
    );
    assertFulfillmentTransition(current?.status || FulfillmentStatus.Planned, FulfillmentStatus.Delivered);
    const fulfillment = await this.database.queryOne<{ demand_id: string }>(
      `select demand_id from app_fulfillments where id = $1 limit 1`,
      [id],
    );
    await this.database.query(
      `update app_fulfillments set status = $2, delivered_at = now(), updated_at = now() where id = $1`,
      [id, FulfillmentStatus.Delivered],
    );
    if (fulfillment?.demand_id) {
      await this.database.query(`update app_demands set status = $2, current_step = $3, updated_at = now() where id = $1`, [
        fulfillment.demand_id,
        'fulfilled',
        'delivered',
      ]);
    }
    await this.database.insertAuditLog({
      tenantId: this.requestContext.getTenantId(),
      actorUserId: user?.id || null,
      entityType: 'fulfillment',
      entityId: id,
      action: 'delivered',
      afterData: { status: FulfillmentStatus.Delivered },
    });
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: { fulfillmentId: id, status: FulfillmentStatus.Delivered },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [FulfillmentController],
})
export class FulfillmentModule {}
