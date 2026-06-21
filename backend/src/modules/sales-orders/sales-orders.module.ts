import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';

type SalesOrderLineInput = {
  product?: string;
  availability?: string;
  orderedQuantity?: number;
  deliveredQuantity?: number;
  units?: string;
  unitPrice?: number;
};

type CreateSalesOrderDto = {
  customer?: string;
  salesperson?: string;
  address?: string;
  date?: string;
  status?: string;
  lines?: SalesOrderLineInput[];
};

type SalesOrderRecord = {
  id: string;
  reference: string;
  date: string;
  time: string;
  customer: string;
  salesperson: string;
  status: string;
  address: string;
  lines: Array<{
    product: string;
    availability: string;
    orderedQuantity: number;
    deliveredQuantity: number;
    units: string;
    unitPrice: number;
  }>;
  grandTotal: number;
};

function formatDateLabel(date: string | Date | null | undefined) {
  if (!date) {
    return '';
  }

  const normalized = date instanceof Date ? date : new Date(`${date}T12:00:00`);
  if (Number.isNaN(normalized.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(normalized);
}

function formatTimeLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isDeliveredStatus(status: string) {
  return status === 'Partially Delivered' || status === 'Delivered' || status === 'Fully Delivered';
}

function calculateLineTotal(line: SalesOrderLineInput, status: string) {
  const quantity = isDeliveredStatus(status) ? Number(line.deliveredQuantity ?? 0) : Number(line.orderedQuantity ?? 0);
  return quantity * Number(line.unitPrice ?? 0);
}

function nextReference(rows: Array<{ reference_no: string }>) {
  const highest = rows.reduce((max, row) => {
    const numeric = Number(row.reference_no.replace(/[^\d]/g, ''));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return `SO-${String(highest + 1).padStart(6, '0')}`;
}

function mapSalesOrderRecord(params: {
  id: string;
  reference: string;
  customer: string;
  salesperson: string;
  address: string;
  status: string;
  orderDate: string;
  orderTime: string;
  lines: SalesOrderLineInput[];
}): SalesOrderRecord {
  const normalizedLines = params.lines.map((line) => ({
    product: line.product?.trim() || '',
    availability: line.availability?.trim() || 'In Stock',
    orderedQuantity: Number(line.orderedQuantity ?? 0),
    deliveredQuantity: Number(line.deliveredQuantity ?? 0),
    units: line.units?.trim() || 'Nos',
    unitPrice: Number(line.unitPrice ?? 0),
  }));

  return {
    id: params.id,
    reference: params.reference,
    date: formatDateLabel(params.orderDate),
    time: params.orderTime,
    customer: params.customer,
    salesperson: params.salesperson,
    status: params.status,
    address: params.address,
    lines: normalizedLines,
    grandTotal: normalizedLines.reduce((sum, line) => sum + calculateLineTotal(line, params.status), 0),
  };
}

@Controller('sales-orders')
export class SalesOrdersController {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @Permissions('sales.view')
  async list(@Query('q') query?: string) {
    const tenantId = this.requestContext.getTenantId();
    const rows = await this.database.query<{
      id: string;
      reference_no: string;
      customer: string;
      salesperson: string;
      address: string;
      status: string;
      order_date: string;
      order_time: string;
      created_at: string;
    }>(
      `select so.id,
              so.reference_no,
              so.customer,
              so.salesperson,
              so.address,
              so.status,
              so.order_date,
              so.order_time,
              so.created_at
       from app_sales_orders so
       where so.tenant_id = $1
         and ($2::text is null or so.reference_no ilike $2 or so.customer ilike $2 or so.salesperson ilike $2)
       order by so.created_at desc`,
      [tenantId, query ? `%${query}%` : null],
    );

    const mappedRows = await Promise.all(
      rows.map(async (row) => {
        const lines = await this.database.query<{
          product_name: string;
          availability: string;
          ordered_quantity: string;
          delivered_quantity: string;
          units: string;
          unit_price: string;
        }>(
          `select product_name, availability, ordered_quantity, delivered_quantity, units, unit_price
           from app_sales_order_lines
           where sales_order_id = $1
           order by created_at asc`,
          [row.id],
        );
        const grandTotal = lines.reduce(
          (sum, line) =>
            sum +
            calculateLineTotal(
              {
                product: line.product_name,
                availability: line.availability,
                orderedQuantity: Number(line.ordered_quantity),
                deliveredQuantity: Number(line.delivered_quantity),
                units: line.units,
                unitPrice: Number(line.unit_price),
              },
              row.status,
            ),
          0,
        );

        return {
          id: row.id,
          reference: row.reference_no,
          date: formatDateLabel(row.order_date),
          time: row.order_time,
          customer: row.customer,
          salesperson: row.salesperson,
          status: row.status,
          address: row.address,
          lines: lines.map((line) => ({
            product: line.product_name,
            availability: line.availability,
            orderedQuantity: Number(line.ordered_quantity),
            deliveredQuantity: Number(line.delivered_quantity),
            units: line.units,
            unitPrice: Number(line.unit_price),
          })),
          grandTotal,
          createdAt: row.created_at,
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
  @Permissions('sales.create')
  async create(@Body() dto: CreateSalesOrderDto, @CurrentUser() actor: { id: string } | null) {
    const tenantId = this.requestContext.getTenantId();
    const now = new Date();
    const referenceRows = await this.database.query<{ reference_no: string }>(
      `select reference_no
       from app_sales_orders
       where tenant_id = $1
       order by created_at desc`,
      [tenantId],
    );
    const reference = nextReference(referenceRows);
    const lines = Array.isArray(dto.lines) ? dto.lines : [];

    const created = await this.database.transaction(async (client) => {
      const parent = await client.query<{ id: string }>(
        `insert into app_sales_orders (
          tenant_id, reference_no, customer, salesperson, address, status, order_date, order_time
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning id`,
        [
          tenantId,
          reference,
          dto.customer?.trim() || '',
          dto.salesperson?.trim() || '',
          dto.address?.trim() || '',
          dto.status || 'Draft',
          dto.date || new Date().toISOString().slice(0, 10),
          formatTimeLabel(now),
        ],
      );

      const parentId = parent.rows[0]?.id;
      if (!parentId) {
        throw new Error('Unable to create sales order');
      }

      for (const line of lines) {
        await client.query(
          `insert into app_sales_order_lines (
            sales_order_id, product_name, availability, ordered_quantity, delivered_quantity, units, unit_price
          ) values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            parentId,
            line.product?.trim() || '',
            line.availability?.trim() || 'In Stock',
            Number(line.orderedQuantity ?? 0),
            Number(line.deliveredQuantity ?? 0),
            line.units?.trim() || 'Nos',
            Number(line.unitPrice ?? 0),
          ],
        );
      }

      return parentId;
    });

    await this.database.insertAuditLog({
      tenantId,
      actorUserId: actor?.id || null,
      entityType: 'sales-order',
      entityId: created,
      action: 'created',
      afterData: dto,
    });

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: mapSalesOrderRecord({
        id: created,
        reference,
        customer: dto.customer?.trim() || '',
        salesperson: dto.salesperson?.trim() || '',
        address: dto.address?.trim() || '',
        status: dto.status || 'Draft',
        orderDate: dto.date || new Date().toISOString().slice(0, 10),
        orderTime: formatTimeLabel(now),
        lines,
      }),
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [SalesOrdersController],
})
export class SalesOrdersModule {}
