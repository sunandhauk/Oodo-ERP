import { Body, Controller, Get, Module, Param, Post } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { assertDemandTransition } from '../../common/workflow/workflow-transition.util';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { DemandStatus } from '../../common/enums/workflow-status.enum';
import { CreateDemandDto } from './demand.dto';

@Controller('demands')
export class DemandController {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @Permissions('sales.view')
  async list() {
    const tenantId = this.requestContext.getTenantId();
    const rows = await this.database.query(
      `select id, reference_no, department, needed_by, priority, status, current_step, created_at
       from app_demands
       where tenant_id = $1
       order by created_at desc`,
      [tenantId],
    );
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: rows,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @Permissions('sales.create')
  async create(@CurrentUser() user: { id: string } | null, @Body() dto: CreateDemandDto) {
    const tenantId = this.requestContext.getTenantId();
    const referenceNo = dto.referenceNo || `DEM-${Date.now()}`;
    const created = await this.database.queryOne<{ id: string }>(
      `insert into app_demands (
        tenant_id, reference_no, requested_by, department, needed_by, priority, status, current_step, notes
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning id`,
      [
        tenantId,
        referenceNo,
        user?.id || null,
        dto.department || null,
        dto.neededBy || null,
        dto.priority || 'normal',
        DemandStatus.Submitted,
        'submitted',
        dto.notes || null,
      ],
    );
    if (!created) {
      throw new Error('Unable to create demand');
    }
    for (const line of dto.lines) {
      await this.database.query(
        `insert into app_demand_lines (demand_id, product_id, quantity, unit_price)
         values ($1, $2, $3, $4)`,
        [created.id, line.productId, line.quantity, line.unitPrice || 0],
      );
    }
    await this.database.insertAuditLog({
      tenantId,
      actorUserId: user?.id || null,
      entityType: 'demand',
      entityId: created.id,
      action: 'created',
      afterData: dto,
    });
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: { id: created.id, referenceNo },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @Permissions('sales.view')
  async getById(@Param('id') id: string) {
    const demand = await this.database.queryOne(
      `select * from app_demands where id = $1 limit 1`,
      [id],
    );
    const lines = await this.database.query(
      `select * from app_demand_lines where demand_id = $1 order by created_at asc`,
      [id],
    );
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: { demand, lines },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/approve')
  @Permissions('sales.approve')
  async approve(@Param('id') id: string, @CurrentUser() user: { id: string } | null) {
    const tenantId = this.requestContext.getTenantId();
    const current = await this.database.queryOne<{ status: string }>(
      `select status from app_demands where id = $1 and tenant_id = $2 limit 1`,
      [id, tenantId],
    );
    assertDemandTransition(current?.status || 'draft', DemandStatus.Approved);
    await this.database.query(`update app_demands set status = $2, current_step = $3, updated_at = now() where id = $1`, [
      id,
      DemandStatus.Approved,
      'approved',
    ]);
    await this.database.insertAuditLog({
      tenantId,
      actorUserId: user?.id || null,
      entityType: 'demand',
      entityId: id,
      action: 'approved',
    });
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: { demandId: id, status: DemandStatus.Approved },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [DemandController],
})
export class DemandModule {}
