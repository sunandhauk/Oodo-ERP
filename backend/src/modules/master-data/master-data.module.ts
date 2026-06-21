import { Body, Controller, Delete, Get, Module, Post, Query, Param } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { CreateLocationDto, CreateProductDto } from './master-data.dto';

function generateNextProductSku(existingSku?: string | null) {
  if (!existingSku) {
    return 'PRD-000001';
  }

  const numeric = Number(existingSku.replace(/[^\d]/g, ''));
  if (!Number.isFinite(numeric)) {
    return `PRD-${Date.now()}`;
  }

  return `PRD-${String(numeric + 1).padStart(6, '0')}`;
}

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
    const rows = await this.database.query<{
      id: string;
      sku: string;
      name: string;
      description: string | null;
      uom: string;
      reorder_level: string;
      status: string;
      sales_price: string;
      cost_price: string;
      on_hand_qty: string;
      category: string;
      image_url: string | null;
      procure_on_demand: boolean;
      procure_source: string | null;
      minimum_qty: string;
      free_to_use_qty: string;
      vendor_name: string;
      bom_reference: string;
      created_at: string;
    }>(
      `select id, sku, name, description, uom, reorder_level, status, sales_price, cost_price, on_hand_qty, category, image_url, procure_on_demand, procure_source, minimum_qty, free_to_use_qty, vendor_name, bom_reference, created_at
       from app_products
       where tenant_id = $1 and ($2::text is null or name ilike $2 or sku ilike $2)
       order by created_at desc`,
      [tenantId, query ? `%${query}%` : null],
    );

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: rows.map((row) => ({
        id: row.id,
        reference: row.sku,
        product: row.name,
        salesPrice: Number(row.sales_price),
        costPrice: Number(row.cost_price),
        onHandQty: Number(row.on_hand_qty),
        status: row.status,
        category: row.category,
        description: row.description || '',
        imageUrl: row.image_url || '',
        createdAt: row.created_at,
        procureOnDemand: row.procure_on_demand,
        procureSource: row.procure_source || undefined,
        minimumQty: Number(row.minimum_qty),
        freeToUseQty: Number(row.free_to_use_qty),
        vendorName: row.vendor_name,
        bomReference: row.bom_reference,
      })),
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('products')
  @Permissions('product.create')
  async createProduct(@Body() dto: CreateProductDto, @CurrentUser() actor: { id: string } | null) {
    const tenantId = this.requestContext.getTenantId();
    const latest = await this.database.queryOne<{ sku: string }>(
      `select sku
       from app_products
       where tenant_id = $1
       order by created_at desc, sku desc
       limit 1`,
      [tenantId],
    );
    const sku = dto.sku || dto.reference || generateNextProductSku(latest?.sku);
    const name = dto.name || dto.product || sku;
    const status = dto.status || 'Draft';
    const row = await this.database.queryOne<{
      id: string;
      sku: string;
      name: string;
      description: string | null;
      uom: string;
      reorder_level: string;
      status: string;
      sales_price: string;
      cost_price: string;
      on_hand_qty: string;
      category: string;
      image_url: string | null;
      procure_on_demand: boolean;
      procure_source: string | null;
      minimum_qty: string;
      free_to_use_qty: string;
      vendor_name: string;
      bom_reference: string;
      created_at: string;
    }>(
       `insert into app_products (
        tenant_id, sku, name, description, uom, reorder_level, status, sales_price, cost_price, on_hand_qty,
        category, image_url, procure_on_demand, procure_source, minimum_qty, free_to_use_qty, vendor_name, bom_reference
      )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       returning id, sku, name, description, uom, reorder_level, status, sales_price, cost_price, on_hand_qty,
                 category, image_url, procure_on_demand, procure_source, minimum_qty, free_to_use_qty, vendor_name, bom_reference, created_at`,
      [
        tenantId,
        sku,
        name,
        dto.description || null,
        dto.uom || 'unit',
        dto.reorderLevel || 0,
        status,
        dto.salesPrice ?? 0,
        dto.costPrice ?? 0,
        dto.onHandQty ?? 0,
        dto.category || '',
        dto.imageUrl || dto.imageDataUrl || null,
        dto.procureOnDemand ?? false,
        dto.procureSource || null,
        dto.minimumQty ?? 0,
        dto.freeToUseQty ?? 0,
        dto.vendorName || dto.vendorOrItem || '',
        dto.bomReference || '',
      ],
    );
    await this.database.insertAuditLog({
      tenantId,
      actorUserId: actor?.id || null,
      entityType: 'product',
      entityId: row?.id || sku,
      action: 'created',
      afterData: dto,
    });
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: row
        ? {
            id: row.id,
            reference: row.sku,
            product: row.name,
            salesPrice: Number(row.sales_price),
            costPrice: Number(row.cost_price),
            onHandQty: Number(row.on_hand_qty),
            status: row.status,
            category: row.category,
            description: row.description || '',
            imageUrl: row.image_url || '',
            createdAt: row.created_at,
            procureOnDemand: row.procure_on_demand,
            procureSource: row.procure_source || undefined,
            minimumQty: Number(row.minimum_qty),
            freeToUseQty: Number(row.free_to_use_qty),
            vendorName: row.vendor_name,
            bomReference: row.bom_reference,
          }
        : null,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @Permissions('product.edit')
  async deleteProduct(@Param('id') id: string, @CurrentUser() actor: { id: string } | null) {
    const tenantId = this.requestContext.getTenantId();
    const row = await this.database.queryOne<{ id: string; sku: string }>(
      `delete from app_products
       where id = $1 and tenant_id = $2
       returning id, sku`,
      [id, tenantId],
    );

    if (!row) {
      return {
        status: RequestStatus.Failure,
        requestId: this.requestContext.getRequestId(),
        data: null,
        error: { message: 'Product not found.' },
        timestamp: new Date().toISOString(),
      };
    }

    await this.database.insertAuditLog({
      tenantId,
      actorUserId: actor?.id || null,
      entityType: 'product',
      entityId: row.id,
      action: 'deleted',
      beforeData: { sku: row.sku },
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
