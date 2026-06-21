import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';

type ManufacturingComponentInput = {
  component?: string;
  availability?: string;
  toConsumeUnits?: number;
  consumeUnits?: number;
  unitCost?: number;
};

type ManufacturingWorkOrderInput = {
  operation?: string;
  assignee?: string;
  plannedHours?: number;
  realHours?: number;
  status?: string;
};

type CreateManufacturingOrderDto = {
  finishedProduct?: string;
  assignee?: string;
  quantity?: number;
  unit?: string;
  scheduleDate?: string;
  billOfMaterial?: string;
  status?: string;
  components?: ManufacturingComponentInput[];
  workOrders?: ManufacturingWorkOrderInput[];
};

function formatDisplayDate(isoDate: string | Date | null | undefined) {
  if (!isoDate) {
    return '';
  }

  const normalized = isoDate instanceof Date ? isoDate : new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(normalized.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(normalized);
}

function formatDisplayTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function nextReference(rows: Array<{ reference_no: string }>) {
  const highest = rows.reduce((max, row) => {
    const numeric = Number(row.reference_no.replace(/[^\d]/g, ''));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return `MO-${String(highest + 1).padStart(6, '0')}`;
}

@Controller('manufacturing-orders')
export class ManufacturingOrdersController {
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
      assignee: string;
      status: string;
      component_status: string;
      quantity: string;
      unit: string;
      schedule_date: string;
      bill_of_material: string;
      order_date: string;
      order_time: string;
      created_at: string;
    }>(
      `select mo.id,
              mo.reference_no,
              mo.finished_product,
              mo.assignee,
              mo.status,
              mo.component_status,
              mo.quantity,
              mo.unit,
              mo.schedule_date,
              mo.bill_of_material,
              mo.order_date,
              mo.order_time,
              mo.created_at
       from app_manufacturing_orders mo
       where mo.tenant_id = $1
         and ($2::text is null or mo.reference_no ilike $2 or mo.finished_product ilike $2 or mo.assignee ilike $2)
       order by mo.created_at desc`,
      [tenantId, query ? `%${query}%` : null],
    );

    const mappedRows = await Promise.all(
      rows.map(async (row) => {
        const components = await this.database.query<{
          component: string;
          availability: string;
          to_consume_units: string;
          consume_units: string;
          unit_cost: string;
        }>(
          `select component, availability, to_consume_units, consume_units, unit_cost
           from app_manufacturing_order_components
           where manufacturing_order_id = $1
           order by created_at asc`,
          [row.id],
        );
        const workOrders = await this.database.query<{
          operation: string;
          assignee: string;
          planned_hours: string;
          real_hours: string;
          status: string;
        }>(
          `select operation, assignee, planned_hours, real_hours, status
           from app_manufacturing_work_orders
           where manufacturing_order_id = $1
           order by created_at asc`,
          [row.id],
        );
        const totalCost = components.reduce((sum, component) => sum + Number(component.consume_units) * Number(component.unit_cost), 0);

        return {
          id: row.id,
          reference: row.reference_no,
          date: formatDisplayDate(row.order_date),
          time: row.order_time,
          finishedProduct: row.finished_product,
          assignee: row.assignee,
          status: row.status,
          componentStatus: row.component_status,
          quantity: Number(row.quantity),
          unit: row.unit,
          scheduleDate: formatDisplayDate(row.schedule_date),
          billOfMaterial: row.bill_of_material,
          components: components.map((component) => ({
            component: component.component,
            availability: component.availability,
            toConsumeUnits: Number(component.to_consume_units),
            consumeUnits: Number(component.consume_units),
            unitCost: Number(component.unit_cost),
          })),
          workOrders: workOrders.map((workOrder) => ({
            operation: workOrder.operation,
            assignee: workOrder.assignee,
            plannedHours: Number(workOrder.planned_hours),
            realHours: Number(workOrder.real_hours),
            status: workOrder.status,
          })),
          totalCost,
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
  async create(@Body() dto: CreateManufacturingOrderDto, @CurrentUser() actor: { id: string } | null) {
    const tenantId = this.requestContext.getTenantId();
    const now = new Date();
    const referenceRows = await this.database.query<{ reference_no: string }>(
      `select reference_no
       from app_manufacturing_orders
       where tenant_id = $1
       order by created_at desc`,
      [tenantId],
    );
    const reference = nextReference(referenceRows);
    const components = Array.isArray(dto.components) ? dto.components : [];
    const workOrders = Array.isArray(dto.workOrders) ? dto.workOrders : [];
    const scheduleDate = dto.scheduleDate || new Date().toISOString().slice(0, 10);

    const createdId = await this.database.transaction(async (client) => {
      const parent = await client.query<{ id: string }>(
        `insert into app_manufacturing_orders (
          tenant_id, reference_no, finished_product, assignee, status, component_status, quantity, unit, schedule_date,
          bill_of_material, order_date, order_time
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        returning id`,
        [
          tenantId,
          reference,
          dto.finishedProduct?.trim() || '',
          dto.assignee?.trim() || '',
          dto.status || 'Draft',
          components.some((component) => String(component.availability || '').toLowerCase().includes('not'))
            ? 'Not Available'
            : 'Available',
          Number(dto.quantity ?? 0),
          dto.unit?.trim() || 'Units',
          scheduleDate,
          dto.billOfMaterial?.trim() || '',
          new Date().toISOString().slice(0, 10),
          formatDisplayTime(now),
        ],
      );

      const parentId = parent.rows[0]?.id;
      if (!parentId) {
        throw new Error('Unable to create manufacturing order');
      }

      for (const component of components) {
        await client.query(
          `insert into app_manufacturing_order_components (
            manufacturing_order_id, component, availability, to_consume_units, consume_units, unit_cost
          ) values ($1, $2, $3, $4, $5, $6)`,
          [
            parentId,
            component.component?.trim() || '',
            component.availability?.trim() || 'Available',
            Number(component.toConsumeUnits ?? 0),
            Number(component.consumeUnits ?? 0),
            Number(component.unitCost ?? 0),
          ],
        );
      }

      for (const workOrder of workOrders) {
        await client.query(
          `insert into app_manufacturing_work_orders (
            manufacturing_order_id, operation, assignee, planned_hours, real_hours, status
          ) values ($1, $2, $3, $4, $5, $6)`,
          [
            parentId,
            workOrder.operation?.trim() || '',
            workOrder.assignee?.trim() || '',
            Number(workOrder.plannedHours ?? 0),
            Number(workOrder.realHours ?? 0),
            workOrder.status || 'Pending',
          ],
        );
      }

      return parentId;
    });

    await this.database.insertAuditLog({
      tenantId,
      actorUserId: actor?.id || null,
      entityType: 'manufacturing-order',
      entityId: createdId,
      action: 'created',
      afterData: dto,
    });

    const normalizedComponents = components.map((component) => ({
      component: component.component?.trim() || '',
      availability: component.availability?.trim() || 'Available',
      toConsumeUnits: Number(component.toConsumeUnits ?? 0),
      consumeUnits: Number(component.consumeUnits ?? 0),
      unitCost: Number(component.unitCost ?? 0),
    }));

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: {
        id: createdId,
        reference,
        date: formatDisplayDate(scheduleDate),
        time: formatDisplayTime(now),
        finishedProduct: dto.finishedProduct?.trim() || '',
        assignee: dto.assignee?.trim() || '',
        status: dto.status || 'Draft',
        componentStatus: normalizedComponents.some((component) => component.availability.toLowerCase().includes('not'))
          ? 'Not Available'
          : 'Available',
        quantity: Number(dto.quantity ?? 0),
        unit: dto.unit?.trim() || 'Units',
        scheduleDate: formatDisplayDate(scheduleDate),
        billOfMaterial: dto.billOfMaterial?.trim() || '',
        components: normalizedComponents,
        workOrders: workOrders.map((workOrder) => ({
          operation: workOrder.operation?.trim() || '',
          assignee: workOrder.assignee?.trim() || '',
          plannedHours: Number(workOrder.plannedHours ?? 0),
          realHours: Number(workOrder.realHours ?? 0),
          status: workOrder.status || 'Pending',
        })),
        totalCost: normalizedComponents.reduce((sum, component) => sum + component.consumeUnits * component.unitCost, 0),
      },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [ManufacturingOrdersController],
})
export class ManufacturingOrdersModule {}
