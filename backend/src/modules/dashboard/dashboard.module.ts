import { Controller, Get, Module } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { DatabaseService } from '../../database/database.service';

type MetricKey =
  | 'salesOrders'
  | 'purchaseOrders'
  | 'manufacturingOrders'
  | 'pendingDeliveries'
  | 'delayedOrders'
  | 'partialReceipts';

type DashboardMetric = {
  key: MetricKey;
  value: number;
  deltaPercent: number;
  spark: number[];
};

type DashboardCompletion = {
  percent: number;
  completed: number;
  inProgress: number;
  pending: number;
  delayed: number;
};

type DashboardSummary = {
  metrics: DashboardMetric[];
  completion: DashboardCompletion;
  salesOverview: {
    total: number;
    statuses: Array<{ label: string; value: number }>;
  };
  purchaseOverview: {
    total: number;
    receivedSeries: number[];
    pendingSeries: number[];
    statuses: Array<{ label: string; value: number }>;
  };
  manufacturingOverview: {
    total: number;
    statuses: Array<{ label: string; value: number }>;
  };
  generatedAt: string;
};

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get('summary')
  @Permissions('dashboard.read')
  async summary() {
    const tenantId = this.requestContext.getTenantId();

    const [
      salesOrders,
      salesOrdersPrevious,
      salesOrdersSpark,
      purchaseOrders,
      purchaseOrdersPrevious,
      purchaseOrdersSpark,
      manufacturingOrders,
      manufacturingOrdersPrevious,
      manufacturingOrdersSpark,
      pendingDeliveries,
      pendingDeliveriesPrevious,
      pendingDeliveriesSpark,
      delayedOrders,
      delayedOrdersPrevious,
      delayedOrdersSpark,
      partialReceipts,
      partialReceiptsPrevious,
      partialReceiptsSpark,
      completion,
      salesOverview,
      purchaseOverview,
      manufacturingOverview,
    ] = await Promise.all([
      this.countCurrent('app_sales_orders', tenantId),
      this.countPrevious('app_sales_orders', tenantId),
      this.getSeries('app_sales_orders', tenantId),
      this.countCurrent('app_procurements', tenantId),
      this.countPrevious('app_procurements', tenantId),
      this.getSeries('app_procurements', tenantId),
      this.countCurrent('app_manufacturing_orders', tenantId),
      this.countPrevious('app_manufacturing_orders', tenantId),
      this.getSeries('app_manufacturing_orders', tenantId),
      this.countCurrent(
        'app_sales_orders',
        tenantId,
        `lower(status) in ('confirmed', 'pending', 'partially delivered')`,
      ),
      this.countPrevious(
        'app_sales_orders',
        tenantId,
        `lower(status) in ('confirmed', 'pending', 'partially delivered')`,
      ),
      this.getSeries(
        'app_sales_orders',
        tenantId,
        `lower(status) in ('confirmed', 'pending', 'partially delivered')`,
      ),
      this.countCurrent(
        'app_sales_orders',
        tenantId,
        `lower(status) in ('confirmed', 'pending', 'partially delivered') and order_date <= current_date - interval '2 days'`,
      ),
      this.countPrevious(
        'app_sales_orders',
        tenantId,
        `lower(status) in ('confirmed', 'pending', 'partially delivered') and order_date <= current_date - interval '9 days'`,
      ),
      this.getSeries(
        'app_sales_orders',
        tenantId,
        `lower(status) in ('confirmed', 'pending', 'partially delivered') and order_date <= current_date`,
      ),
      this.countCurrent('app_procurements', tenantId, `lower(status) in ('pending', 'partially_received')`),
      this.countPrevious('app_procurements', tenantId, `lower(status) in ('pending', 'partially_received')`),
      this.getSeries('app_procurements', tenantId, `lower(status) in ('pending', 'partially_received')`),
      this.getCompletionSummary(tenantId),
      this.getSalesOverview(tenantId),
      this.getPurchaseOverview(tenantId),
      this.getManufacturingOverview(tenantId),
    ]);

    const summary: DashboardSummary = {
      metrics: [
        {
          key: 'salesOrders',
          value: salesOrders,
          deltaPercent: this.getDeltaPercent(salesOrders, salesOrdersPrevious),
          spark: salesOrdersSpark,
        },
        {
          key: 'purchaseOrders',
          value: purchaseOrders,
          deltaPercent: this.getDeltaPercent(purchaseOrders, purchaseOrdersPrevious),
          spark: purchaseOrdersSpark,
        },
        {
          key: 'manufacturingOrders',
          value: manufacturingOrders,
          deltaPercent: this.getDeltaPercent(manufacturingOrders, manufacturingOrdersPrevious),
          spark: manufacturingOrdersSpark,
        },
        {
          key: 'pendingDeliveries',
          value: pendingDeliveries,
          deltaPercent: this.getDeltaPercent(pendingDeliveries, pendingDeliveriesPrevious),
          spark: pendingDeliveriesSpark,
        },
        {
          key: 'delayedOrders',
          value: delayedOrders,
          deltaPercent: this.getDeltaPercent(delayedOrders, delayedOrdersPrevious),
          spark: delayedOrdersSpark,
        },
        {
          key: 'partialReceipts',
          value: partialReceipts,
          deltaPercent: this.getDeltaPercent(partialReceipts, partialReceiptsPrevious),
          spark: partialReceiptsSpark,
        },
      ],
      completion,
      salesOverview,
      purchaseOverview,
      manufacturingOverview,
      generatedAt: new Date().toISOString(),
    };

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: summary,
      error: null,
      timestamp: summary.generatedAt,
    };
  }

  private async countCurrent(table: string, tenantId: string, extraWhere = '') {
    const clause = extraWhere ? `and ${extraWhere}` : '';
    const row = await this.database.queryOne<{ total: string }>(
      `select count(*)::int as total from ${table} where tenant_id = $1 and created_at >= current_date - interval '6 days' and created_at < current_date + interval '1 day' ${clause}`,
      [tenantId],
    );
    return Number(row?.total ?? 0);
  }

  private async countPrevious(table: string, tenantId: string, extraWhere = '') {
    const clause = extraWhere ? `and ${extraWhere}` : '';
    const row = await this.database.queryOne<{ total: string }>(
      `select count(*)::int as total from ${table} where tenant_id = $1 and created_at >= current_date - interval '13 days' and created_at < current_date - interval '6 days' ${clause}`,
      [tenantId],
    );
    return Number(row?.total ?? 0);
  }

  private async getSeries(table: string, tenantId: string, extraWhere = '') {
    const clause = extraWhere ? `and ${extraWhere}` : '';
    const rows = await this.database.query<{ total: string }>(
      `select coalesce(agg.total, 0)::int as total
       from generate_series(current_date - interval '6 days', current_date, interval '1 day') as day_bucket
       left join (
         select date_trunc('day', created_at)::date as day, count(*)::int as total
         from ${table}
         where tenant_id = $1
           and created_at >= current_date - interval '6 days'
           and created_at < current_date + interval '1 day'
           ${clause}
         group by 1
       ) agg on agg.day = day_bucket::date
       order by day_bucket asc`,
      [tenantId],
    );
    return rows.map((row) => Number(row.total ?? 0));
  }

  private async getCompletionSummary(tenantId: string): Promise<DashboardCompletion> {
    const [total, completed, inProgress, pending, delayed] = await Promise.all([
      this.database.queryOne<{ total: string }>(
        `select (
           (select count(*) from app_sales_orders where tenant_id = $1) +
           (select count(*) from app_procurements where tenant_id = $1) +
           (select count(*) from app_manufacturing_orders where tenant_id = $1)
         )::int as total`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(
        `select (
           (select count(*) from app_sales_orders where tenant_id = $1 and lower(status) = 'delivered') +
           (select count(*) from app_procurements where tenant_id = $1 and lower(status) = 'received') +
           (select count(*) from app_manufacturing_orders where tenant_id = $1 and lower(status) = 'done')
         )::int as total`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(
        `select (
           (select count(*) from app_sales_orders where tenant_id = $1 and lower(status) in ('confirmed', 'pending', 'partially delivered')) +
           (select count(*) from app_procurements where tenant_id = $1 and lower(status) in ('confirmed', 'ordered', 'pending', 'partially_received')) +
           (select count(*) from app_manufacturing_orders where tenant_id = $1 and lower(status) in ('confirmed', 'in progress'))
         )::int as total`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(
        `select (
           (select count(*) from app_sales_orders where tenant_id = $1 and lower(status) = 'draft') +
           (select count(*) from app_procurements where tenant_id = $1 and lower(status) = 'draft') +
           (select count(*) from app_manufacturing_orders where tenant_id = $1 and lower(status) = 'draft')
         )::int as total`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(
        `select count(*)::int as total
         from app_sales_orders
         where tenant_id = $1
           and lower(status) in ('confirmed', 'pending', 'partially delivered')
           and order_date <= current_date - interval '2 days'`,
        [tenantId],
      ),
    ]);

    const totalCount = Number(total?.total ?? 0);
    const completedCount = Number(completed?.total ?? 0);
    return {
      percent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      completed: completedCount,
      inProgress: Number(inProgress?.total ?? 0),
      pending: Number(pending?.total ?? 0),
      delayed: Number(delayed?.total ?? 0),
    };
  }

  private async getSalesOverview(tenantId: string) {
    const [draft, confirmed, pending, partial, delivered, cancelled, total] = await Promise.all([
      this.database.queryOne<{ total: string }>(`select count(*)::int as total from app_sales_orders where tenant_id = $1 and lower(status) = 'draft'`, [tenantId]),
      this.database.queryOne<{ total: string }>(
        `select count(*)::int as total from app_sales_orders where tenant_id = $1 and lower(status) = 'confirmed'`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(
        `select count(*)::int as total from app_sales_orders where tenant_id = $1 and lower(status) = 'pending'`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(
        `select count(*)::int as total from app_sales_orders where tenant_id = $1 and lower(status) = 'partially delivered'`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(`select count(*)::int as total from app_sales_orders where tenant_id = $1 and lower(status) = 'delivered'`, [tenantId]),
      this.database.queryOne<{ total: string }>(`select count(*)::int as total from app_sales_orders where tenant_id = $1 and lower(status) = 'cancelled'`, [tenantId]),
      this.database.queryOne<{ total: string }>(`select count(*)::int as total from app_sales_orders where tenant_id = $1`, [tenantId]),
    ]);

    return {
      total: Number(total?.total ?? 0),
      statuses: [
        { label: 'Draft', value: Number(draft?.total ?? 0) },
        { label: 'Confirmed', value: Number(confirmed?.total ?? 0) },
        { label: 'Pending', value: Number(pending?.total ?? 0) },
        { label: 'Partially Delivered', value: Number(partial?.total ?? 0) },
        { label: 'Delivered', value: Number(delivered?.total ?? 0) },
        { label: 'Cancelled', value: Number(cancelled?.total ?? 0) },
      ],
    };
  }

  private async getPurchaseOverview(tenantId: string) {
    const [total, draft, confirmed, pending, received, cancelled, receivedSeries, pendingSeries] = await Promise.all([
      this.database.queryOne<{ total: string }>(`select count(*)::int as total from app_procurements where tenant_id = $1`, [tenantId]),
      this.database.queryOne<{ total: string }>(
        `select count(*)::int as total from app_procurements where tenant_id = $1 and lower(status) = 'draft'`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(
        `select count(*)::int as total from app_procurements where tenant_id = $1 and lower(status) in ('confirmed', 'ordered')`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(
        `select count(*)::int as total from app_procurements where tenant_id = $1 and lower(status) in ('pending', 'partially_received')`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(
        `select count(*)::int as total from app_procurements where tenant_id = $1 and lower(status) = 'received'`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(
        `select count(*)::int as total from app_procurements where tenant_id = $1 and lower(status) = 'cancelled'`,
        [tenantId],
      ),
      this.getSeries('app_procurements', tenantId, `lower(status) in ('received', 'partially_received')`),
      this.getSeries('app_procurements', tenantId, `lower(status) in ('draft', 'confirmed', 'ordered', 'pending', 'partially_received')`),
    ]);

    return {
      total: Number(total?.total ?? 0),
      receivedSeries,
      pendingSeries,
      statuses: [
        { label: 'Draft', value: Number(draft?.total ?? 0) },
        { label: 'Confirmed', value: Number(confirmed?.total ?? 0) },
        { label: 'Pending', value: Number(pending?.total ?? 0) },
        { label: 'Received', value: Number(received?.total ?? 0) },
        { label: 'Cancelled', value: Number(cancelled?.total ?? 0) },
      ],
    };
  }

  private async getManufacturingOverview(tenantId: string) {
    const [total, draft, confirmed, inProgress, done, cancelled] = await Promise.all([
      this.database.queryOne<{ total: string }>(`select count(*)::int as total from app_manufacturing_orders where tenant_id = $1`, [tenantId]),
      this.database.queryOne<{ total: string }>(
        `select count(*)::int as total from app_manufacturing_orders where tenant_id = $1 and status = 'Draft'`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(
        `select count(*)::int as total from app_manufacturing_orders where tenant_id = $1 and status = 'Confirmed'`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(
        `select count(*)::int as total from app_manufacturing_orders where tenant_id = $1 and status = 'In Progress'`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(
        `select count(*)::int as total from app_manufacturing_orders where tenant_id = $1 and status = 'Done'`,
        [tenantId],
      ),
      this.database.queryOne<{ total: string }>(
        `select count(*)::int as total from app_manufacturing_orders where tenant_id = $1 and status = 'Cancelled'`,
        [tenantId],
      ),
    ]);

    return {
      total: Number(total?.total ?? 0),
      statuses: [
        { label: 'Draft', value: Number(draft?.total ?? 0) },
        { label: 'Confirmed', value: Number(confirmed?.total ?? 0) },
        { label: 'In Progress', value: Number(inProgress?.total ?? 0) },
        { label: 'Done', value: Number(done?.total ?? 0) },
        { label: 'Cancelled', value: Number(cancelled?.total ?? 0) },
      ],
    };
  }

  private getDeltaPercent(current: number, previous: number) {
    if (previous <= 0) {
      return current > 0 ? 100 : 0;
    }

    return Math.round(((current - previous) / previous) * 100);
  }
}

@Module({
  controllers: [DashboardController],
})
export class DashboardModule {}
