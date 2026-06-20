import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { CreateNotificationDto } from './notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @Permissions('notifications.manage')
  async list() {
    const tenantId = this.requestContext.getTenantId();
    const rows = await this.database.query(
      `select id, type, title, body, status, data, created_at
       from app_notifications
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
  @Permissions('notifications.manage')
  async create(@Body() dto: CreateNotificationDto, @CurrentUser() actor: { id: string } | null) {
    const tenantId = this.requestContext.getTenantId();
    const row = await this.database.queryOne<{ id: string }>(
      `insert into app_notifications (tenant_id, user_id, type, title, body, status, data)
       values ($1, $2, $3, $4, $5, 'queued', $6)
       returning id`,
      [tenantId, dto.userId || null, dto.type || 'system', dto.title, dto.body, dto.data || null],
    );
    await this.database.insertAuditLog({
      tenantId,
      actorUserId: actor?.id || null,
      entityType: 'notification',
      entityId: row?.id || dto.title,
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
  controllers: [NotificationsController],
})
export class NotificationsModule {}
