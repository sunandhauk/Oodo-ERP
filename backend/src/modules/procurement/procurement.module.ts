import { BadRequestException, Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProgressRoute } from '../../common/decorators/progress-route.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { assertProcurementTransition } from '../../common/workflow/workflow-transition.util';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { ProcurementStatus } from '../../common/enums/workflow-status.enum';
import { CreateProcurementFromDemandDto, ReceiveProcurementDto } from './procurement.dto';

type ProcurementLineInput = {
  product?: string;
  orderedQuantity?: number;
  receivedQuantity?: number;
  units?: string;
  unitCost?: number;
};

type CreateProcurementDto = {
  vendor?: string;
  responsible?: string;
  address?: string;
  date?: string;
  status?: string;
  lines?: ProcurementLineInput[];
};

function formatDisplayDate(isoDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00`));
}

function formatDisplayTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function nextReference(rows: Array<{ po_number: string }>) {
  const highest = rows.reduce((max, row) => {
    const numeric = Number(row.po_number.replace(/[^\d]/g, ''));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return `PO-${String(highest + 1).padStart(6, '0')}`;
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function mapProcurementRecord(params: {
  id: string;
  reference: string;
  vendor: string;
  responsible: string;
  status: string;
  date: string;
  createdAt: Date;
  lines: ProcurementLineInput[];
}) {
  const normalizedLines = params.lines.map((line) => ({
    product: line.product?.trim() || '',
    orderedQuantity: Number(line.orderedQuantity ?? 0),
    receivedQuantity: Number(line.receivedQuantity ?? 0),
    units: line.units?.trim() || 'Nos',
    unitCost: Number(line.unitCost ?? 0),
  }));

  return {
    id: params.id,
    reference: params.reference,
    date: formatDisplayDate(params.date),
    time: formatDisplayTime(params.createdAt),
    vendor: params.vendor,
    responsible: params.responsible,
    status: params.status,
    address: '',
    lines: normalizedLines,
    grandTotal: normalizedLines.reduce((sum, line) => sum + line.orderedQuantity * line.unitCost, 0),
  };
}

@Controller('procurements')
export class ProcurementController {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @Permissions('purchase.view')
  async list(@Query('q') query?: string) {
    const tenantId = this.requestContext.getTenantId();
    const rows = await this.database.query<{
      id: string;
      po_number: string;
      supplier_name: string;
      status: string;
      expected_date: string | null;
      received_at: string | null;
      created_at: string;
    }>(
      `select id, po_number, supplier_name, status, expected_date, received_at, created_at
       from app_procurements
       where tenant_id = $1
         and ($2::text is null or po_number ilike $2 or supplier_name ilike $2 or status ilike $2)
       order by created_at desc`,
      [tenantId, query ? `%${query}%` : null],
    );

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: rows.map((row) => ({
        id: row.id,
        reference: row.po_number,
        date: new Intl.DateTimeFormat('en-US', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).format(new Date(row.created_at)),
        time: new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(row.created_at)),
        vendor: row.supplier_name,
        responsible: row.supplier_name,
        status: row.status,
        address: '',
        lines: [],
        grandTotal: 0,
        expectedDate: row.expected_date,
        receivedAt: row.received_at,
      })),
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @Permissions('purchase.create')
  async create(@Body() dto: CreateProcurementDto, @CurrentUser() actor: { id: string } | null) {
    const tenantId = this.requestContext.getTenantId();
    const now = new Date();
    const referenceRows = await this.database.query<{ po_number: string }>(
      `select po_number
       from app_procurements
       where tenant_id = $1
       order by created_at desc`,
      [tenantId],
    );
    const reference = nextReference(referenceRows);
    const lines = Array.isArray(dto.lines) ? dto.lines : [];

    const createdId = await this.database.transaction(async (client) => {
      const parent = await client.query<{ id: string }>(
        `insert into app_procurements (
          tenant_id, po_number, supplier_name, status, expected_date
        ) values ($1, $2, $3, $4, $5)
        returning id`,
        [
          tenantId,
          reference,
          dto.vendor?.trim() || dto.responsible?.trim() || '',
          dto.status || 'Draft',
          dto.date || null,
        ],
      );

      const parentId = parent.rows[0]?.id;
      if (!parentId) {
        throw new Error('Unable to create procurement');
      }

      for (const line of lines) {
        const productRef = line.product?.trim() || '';
        if (!productRef) {
          throw new BadRequestException('Each purchase order line must include a product.');
        }

        const resolvedProduct = looksLikeUuid(productRef)
          ? await client.query<{ id: string }>(
              `select id
               from app_products
               where tenant_id = $1 and id = $2::uuid
               limit 1`,
              [tenantId, productRef],
            )
          : await client.query<{ id: string }>(
              `select id
               from app_products
               where tenant_id = $1 and (lower(name) = lower($2) or lower(sku) = lower($2))
               limit 1`,
              [tenantId, productRef],
            );

        const productId = resolvedProduct.rows[0]?.id;
        if (!productId) {
          throw new BadRequestException(`Unknown product: ${productRef}. Please select a saved product.`);
        }

        await client.query(
          `insert into app_procurement_lines (procurement_id, product_id, quantity, unit_cost)
           values ($1, $2, $3, $4)`,
          [
            parentId,
            productId,
            Number(line.orderedQuantity ?? 0),
            Number(line.unitCost ?? 0),
          ],
        );
      }

      return parentId;
    });

    await this.database.insertAuditLog({
      tenantId,
      actorUserId: actor?.id || null,
      entityType: 'procurement',
      entityId: createdId,
      action: 'created',
      afterData: dto,
    });

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: mapProcurementRecord({
        id: createdId,
        reference,
        vendor: dto.vendor?.trim() || dto.responsible?.trim() || '',
        responsible: dto.responsible?.trim() || dto.vendor?.trim() || '',
        status: dto.status || 'Draft',
        date: dto.date || new Date().toISOString().slice(0, 10),
        createdAt: now,
        lines,
      }),
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

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
