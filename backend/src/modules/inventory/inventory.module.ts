import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { InventoryMovementType } from '../../common/enums/workflow-status.enum';
import { CreateInventoryMovementDto } from './inventory.dto';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post('movements')
  @Permissions('inventory.manage')
  async createMovement(
    @CurrentUser() user: { id: string } | null,
    @Body() dto: CreateInventoryMovementDto,
  ) {
    const tenantId = this.requestContext.getTenantId();
    const row = await this.database.queryOne<{ id: string }>(
      `insert into app_inventory_movements (
        tenant_id, product_id, location_id, movement_type, quantity, reference_type, reference_id, created_by
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      returning id`,
      [
        tenantId,
        dto.productId,
        dto.locationId || null,
        dto.movementType,
        dto.quantity,
        dto.referenceType || null,
        dto.referenceId || null,
        user?.id || null,
      ],
    );
    await this.database.insertAuditLog({
      tenantId,
      actorUserId: user?.id || null,
      entityType: 'inventory_movement',
      entityId: row?.id || 'unknown',
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

  @Get('stock/:productId')
  @Permissions('inventory.manage')
  async stock(@Param('productId') productId: string, @Query('locationId') locationId?: string) {
    const tenantId = this.requestContext.getTenantId();
    const rows = await this.database.query<{ net_qty: string }>(
      `select coalesce(sum(
         case
           when movement_type in ('receipt', 'adjustment', 'return') then quantity
           when movement_type in ('reservation', 'issue') then -quantity
           else 0
         end
       ), 0) as net_qty
       from app_inventory_movements
       where tenant_id = $1 and product_id = $2 and ($3::uuid is null or location_id = $3::uuid)`,
      [tenantId, productId, locationId || null],
    );
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: {
        productId,
        locationId: locationId || null,
        quantity: rows[0]?.net_qty ?? '0',
      },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [InventoryController],
})
export class InventoryModule {}
