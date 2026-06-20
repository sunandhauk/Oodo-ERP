import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { CreateLocationDto, CreateProductDto } from './master-data.dto';

@Controller('master-data')
export class MasterDataController {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get('products')
  @Permissions('product.view')
  async listProducts(@Query('q') query?: string) {
    const tenantId = this.requestContext.getTenantId();
    const rows = await this.database.query(
      `select id, sku, name, description, uom, reorder_level, status
       from app_products
       where tenant_id = $1 and ($2::text is null or name ilike $2 or sku ilike $2)
       order by created_at desc`,
      [tenantId, query ? `%${query}%` : null],
    );

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: rows,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('products')
  @Permissions('product.create')
  async createProduct(@Body() dto: CreateProductDto, @CurrentUser() actor: { id: string } | null) {
    const tenantId = this.requestContext.getTenantId();
    const row = await this.database.queryOne<{ id: string }>(
      `insert into app_products (tenant_id, sku, name, description, uom, reorder_level, status)
       values ($1, $2, $3, $4, $5, $6, 'active')
       returning id`,
      [tenantId, dto.sku, dto.name, dto.description || null, dto.uom || 'unit', dto.reorderLevel || 0],
    );
    await this.database.insertAuditLog({
      tenantId,
      actorUserId: actor?.id || null,
      entityType: 'product',
      entityId: row?.id || dto.sku,
      action: 'created',
      afterData: dto,
    });
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: row,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('locations')
  @Permissions('master-data.manage')
  async listLocations() {
    const tenantId = this.requestContext.getTenantId();
    const rows = await this.database.query(
      `select id, code, name, type
       from app_locations
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

  @Post('locations')
  @Permissions('master-data.manage')
  async createLocation(@Body() dto: CreateLocationDto, @CurrentUser() actor: { id: string } | null) {
    const tenantId = this.requestContext.getTenantId();
    const row = await this.database.queryOne<{ id: string }>(
      `insert into app_locations (tenant_id, code, name, type)
       values ($1, $2, $3, $4)
       returning id`,
      [tenantId, dto.code, dto.name, dto.type || 'warehouse'],
    );
    await this.database.insertAuditLog({
      tenantId,
      actorUserId: actor?.id || null,
      entityType: 'location',
      entityId: row?.id || dto.code,
      action: 'created',
      afterData: dto,
    });
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: row,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [MasterDataController],
})
export class MasterDataModule {}
