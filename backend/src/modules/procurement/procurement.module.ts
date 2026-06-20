import { Body, Controller, Module, Param, Post } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProgressRoute } from '../../common/decorators/progress-route.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { assertProcurementTransition } from '../../common/workflow/workflow-transition.util';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { ProcurementStatus } from '../../common/enums/workflow-status.enum';
import { CreateProcurementFromDemandDto, ReceiveProcurementDto } from './procurement.dto';

@Controller('procurements')
export class ProcurementController {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post('from-demand/:demandId')
  @Permissions('purchase.create')
  @ProgressRoute()
  async createFromDemand(
    @Param('demandId') demandId: string,
    @Body() dto: CreateProcurementFromDemandDto,
    @CurrentUser() actor: { id: string } | null,
  ) {
    const requestId = this.requestContext.getRequestId();
    const tenantId = this.requestContext.getTenantId();
    void this.runBackgroundProcurement(requestId, tenantId, demandId, dto, actor?.id || null);
    return {
      status: RequestStatus.Progress,
      requestId,
      data: {
        demandId,
        message: 'Procurement creation started.',
      },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/receive')
  @Permissions('purchase.approve')
  async receive(@Param('id') id: string, @Body() dto: ReceiveProcurementDto, @CurrentUser() actor: { id: string } | null) {
    const current = await this.database.queryOne<{ status: string; tenant_id: string; demand_id: string | null }>(
      `select status, tenant_id, demand_id from app_procurements where id = $1 limit 1`,
      [id],
    );
    assertProcurementTransition(current?.status || ProcurementStatus.Draft, ProcurementStatus.Received);
    await this.database.query(
      `update app_procurements
       set status = $2, received_at = coalesce($3::timestamptz, now()), updated_at = now()
       where id = $1`,
      [id, ProcurementStatus.Received, dto.receivedAt || null],
    );
    const lines = await this.database.query<{ product_id: string; quantity: string }>(
      `select product_id, quantity from app_procurement_lines where procurement_id = $1`,
      [id],
    );
    for (const line of lines) {
      await this.database.query(
        `insert into app_inventory_movements (
          tenant_id, product_id, movement_type, quantity, reference_type, reference_id
        ) values ($1, $2, $3, $4, $5, $6)`,
        [
          current?.tenant_id || this.requestContext.getTenantId(),
          line.product_id,
          'receipt',
          line.quantity,
          'procurement',
          id,
        ],
      );
    }
    if (current?.demand_id) {
      await this.database.query(`update app_demands set current_step = $2, updated_at = now() where id = $1`, [
        current.demand_id,
        'procurement-received',
      ]);
    }
    await this.database.insertAuditLog({
      tenantId: current?.tenant_id || this.requestContext.getTenantId(),
      actorUserId: actor?.id || null,
      entityType: 'procurement',
      entityId: id,
      action: 'received',
      afterData: { receivedAt: dto.receivedAt || new Date().toISOString() },
    });
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: { procurementId: id, status: ProcurementStatus.Received },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  private async runBackgroundProcurement(
    requestId: string,
    tenantId: string,
    demandId: string,
    dto: CreateProcurementFromDemandDto,
    actorId: string | null,
  ) {
    setImmediate(async () => {
      try {
        await this.database.finishRequestJob(requestId, {
          status: RequestStatus.Progress,
          responseStatus: 202,
          progressStep: 'validating-demand',
          progressPercent: 25,
        });
        const demand = await this.database.queryOne<{ id: string; reference_no: string }>(
          `select id, reference_no from app_demands where id = $1 and tenant_id = $2 limit 1`,
          [demandId, tenantId],
        );
        if (!demand) {
          throw new Error('Demand not found');
        }

        const procurement = await this.database.queryOne<{ id: string; po_number: string }>(
          `insert into app_procurements (tenant_id, demand_id, po_number, supplier_name, status, expected_date)
           values ($1, $2, $3, $4, $5, $6)
           returning id, po_number`,
          [
            tenantId,
            demandId,
            `PO-${Date.now()}`,
            dto.supplierName,
            ProcurementStatus.Ordered,
            dto.expectedDate || null,
          ],
        );
        if (!procurement) {
          throw new Error('Unable to create procurement');
        }

        const lines = await this.database.query<{ product_id: string; quantity: string }>(
          `select product_id, quantity from app_demand_lines where demand_id = $1 order by created_at asc`,
          [demandId],
        );
        for (const line of lines) {
          await this.database.query(
            `insert into app_procurement_lines (procurement_id, product_id, quantity, unit_cost)
             values ($1, $2, $3, 0)`,
            [procurement.id, line.product_id, line.quantity],
          );
        }

        await this.database.query(
          `update app_demands set status = $2, current_step = $3, updated_at = now() where id = $1`,
          [demandId, 'procured', 'procurement-created'],
        );
        await this.database.insertAuditLog({
          tenantId,
          actorUserId: actorId,
          entityType: 'procurement',
          entityId: procurement.id,
          action: 'created-from-demand',
          afterData: { demandId, procurementId: procurement.id },
        });
        await this.database.finishRequestJob(requestId, {
          status: RequestStatus.Success,
          responseStatus: 201,
          responsePayload: { procurementId: procurement.id, poNumber: procurement.po_number },
          progressStep: 'completed',
          progressPercent: 100,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown procurement error';
        await this.database.finishRequestJob(requestId, {
          status: RequestStatus.Failure,
          responseStatus: 500,
          errorCode: 'PROCUREMENT_FAILED',
          errorMessage: message,
        });
      }
    });
  }
}

@Module({
  controllers: [ProcurementController],
})
export class ProcurementModule {}
