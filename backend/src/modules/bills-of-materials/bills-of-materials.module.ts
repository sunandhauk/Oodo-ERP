import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';

type BomComponentInput = {
  component?: string;
  availability?: string;
  toConsumeUnits?: number;
  consumeUnits?: number;
};

type BomWorkOrderInput = {
  operation?: string;
  assignee?: string;
  plannedHours?: number;
  status?: string;
};

type CreateBomDto = {
  finishedProduct?: string;
  quantity?: number;
  unit?: string;
  alternative?: string;
  reference?: string;
  status?: string;
  components?: BomComponentInput[];
  workOrders?: BomWorkOrderInput[];
};

function formatDisplayDate(isoDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00`));
}

function nextReference(rows: Array<{ reference_no: string }>) {
  const highest = rows.reduce((max, row) => {
    const numeric = Number(row.reference_no.replace(/[^\d]/g, ''));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return `BOM-${String(highest + 1).padStart(6, '0')}`;
}

@Controller('bills-of-materials')
export class BillsOfMaterialsController {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @Permissions('manufacturing.view')
  async list(@Query('q') query?: string) {
    const tenantId = this.requestContext.getTenantId();
    const rows = await this.database.query<{
      id: string;
      reference_no: string;
      finished_product: string;
      quantity: string;
      unit: string;
      alternative: string;
      attached_log: string;
      status: string;
      created_at: string;
    }>(
      `select bom.id,
              bom.reference_no,
              bom.finished_product,
              bom.quantity,
              bom.unit,
              bom.alternative,
              bom.attached_log,
              bom.status,
              bom.created_at
       from app_boms bom
       where bom.tenant_id = $1
         and ($2::text is null or bom.reference_no ilike $2 or bom.finished_product ilike $2 or bom.alternative ilike $2)
       order by bom.created_at desc`,
      [tenantId, query ? `%${query}%` : null],
    );

    const mappedRows = await Promise.all(
      rows.map(async (row) => {
        const components = await this.database.query<{
          component: string;
          availability: string;
          to_consume_units: string;
          consume_units: string;
        }>(
          `select component, availability, to_consume_units, consume_units
           from app_bom_components
           where bom_id = $1
           order by created_at asc`,
          [row.id],
        );
        const workOrders = await this.database.query<{
          operation: string;
          assignee: string;
          planned_hours: string;
          status: string;
        }>(
          `select operation, assignee, planned_hours, status
           from app_bom_work_orders
           where bom_id = $1
           order by created_at asc`,
          [row.id],
        );

        return {
          id: row.id,
          reference: row.reference_no,
          finishedProduct: row.finished_product,
          quantity: Number(row.quantity),
          unit: row.unit,
          alternative: row.alternative,
          attachedLog: row.attached_log,
          status: row.status,
          components: components.map((component) => ({
            component: component.component,
            availability: component.availability,
            toConsumeUnits: Number(component.to_consume_units),
            consumeUnits: Number(component.consume_units),
          })),
          workOrders: workOrders.map((workOrder) => ({
            operation: workOrder.operation,
            assignee: workOrder.assignee,
            plannedHours: Number(workOrder.planned_hours),
            status: workOrder.status,
          })),
          createdAt: new Intl.DateTimeFormat('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }).format(new Date(row.created_at)),
        };
      }),
    );

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: mappedRows,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @Permissions('manufacturing.create')
  async create(@Body() dto: CreateBomDto, @CurrentUser() actor: { id: string } | null) {
    const tenantId = this.requestContext.getTenantId();
    const referenceRows = await this.database.query<{ reference_no: string }>(
      `select reference_no
       from app_boms
       where tenant_id = $1
       order by created_at desc`,
      [tenantId],
    );
    const reference = dto.reference?.trim() || nextReference(referenceRows);
    const components = Array.isArray(dto.components) ? dto.components : [];
    const workOrders = Array.isArray(dto.workOrders) ? dto.workOrders : [];

    const createdId = await this.database.transaction(async (client) => {
      const parent = await client.query<{ id: string }>(
        `insert into app_boms (
          tenant_id, reference_no, finished_product, quantity, unit, alternative, attached_log, status
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning id`,
        [
          tenantId,
          reference,
          dto.finishedProduct?.trim() || '',
          Number(dto.quantity ?? 0),
          dto.unit?.trim() || 'Units',
          dto.alternative?.trim() || '',
          `${reference}.pdf`,
          dto.status || 'Draft',
        ],
      );

      const parentId = parent.rows[0]?.id;
      if (!parentId) {
        throw new Error('Unable to create bill of materials');
      }

      for (const component of components) {
        await client.query(
          `insert into app_bom_components (
            bom_id, component, availability, to_consume_units, consume_units
          ) values ($1, $2, $3, $4, $5)`,
          [
            parentId,
            component.component?.trim() || '',
            component.availability?.trim() || 'Available',
            Number(component.toConsumeUnits ?? 0),
            Number(component.consumeUnits ?? 0),
          ],
        );
      }

      for (const workOrder of workOrders) {
        await client.query(
          `insert into app_bom_work_orders (
            bom_id, operation, assignee, planned_hours, status
          ) values ($1, $2, $3, $4, $5)`,
          [
            parentId,
            workOrder.operation?.trim() || '',
            workOrder.assignee?.trim() || '',
            Number(workOrder.plannedHours ?? 0),
            workOrder.status || 'Pending',
          ],
        );
      }

      return parentId;
    });

    await this.database.insertAuditLog({
      tenantId,
      actorUserId: actor?.id || null,
      entityType: 'bom',
      entityId: createdId,
      action: 'created',
      afterData: dto,
    });

    const normalizedComponents = components.map((component) => ({
      component: component.component?.trim() || '',
      availability: component.availability?.trim() || 'Available',
      toConsumeUnits: Number(component.toConsumeUnits ?? 0),
      consumeUnits: Number(component.consumeUnits ?? 0),
    }));

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: {
        id: createdId,
        reference,
        finishedProduct: dto.finishedProduct?.trim() || '',
        quantity: Number(dto.quantity ?? 0),
        unit: dto.unit?.trim() || 'Units',
        alternative: dto.alternative?.trim() || '',
        attachedLog: `${reference}.pdf`,
        status: dto.status || 'Draft',
        components: normalizedComponents,
        workOrders: workOrders.map((workOrder) => ({
          operation: workOrder.operation?.trim() || '',
          assignee: workOrder.assignee?.trim() || '',
          plannedHours: Number(workOrder.plannedHours ?? 0),
          status: workOrder.status || 'Pending',
        })),
        createdAt: formatDisplayDate(new Date().toISOString().slice(0, 10)),
      },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [BillsOfMaterialsController],
})
export class BillsOfMaterialsModule {}
