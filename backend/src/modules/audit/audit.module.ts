import { Controller, Get, Module, Query } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';

@Controller('audit')
export class AuditController {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @Permissions('audit.read')
  async list(@Query('entityType') entityType?: string) {
    const tenantId = this.requestContext.getTenantId();
    const rows = await this.database.query(
      `select id, entity_type, entity_id, action, before_data, after_data, meta, created_at
       from app_audit_logs
       where tenant_id = $1 and ($2::text is null or entity_type = $2)
       order by created_at desc`,
      [tenantId, entityType || null],
    );
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: rows,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [AuditController],
})
export class AuditModule {}
