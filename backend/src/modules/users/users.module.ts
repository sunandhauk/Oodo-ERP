import { Body, Controller, Get, Module, Param, Patch, Post } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { hashPassword } from '../../common/security/password.util';
import { CreateUserDto, SetUserRolesDto } from './users.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @Permissions('users.manage')
  async list() {
    const tenantId = this.requestContext.getTenantId();
    const rows = await this.database.query(
      `select id, login_id, email, full_name, status, created_at
       from app_users
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
  @Permissions('users.manage')
  async create(@Body() dto: CreateUserDto, @CurrentUser() actor: { id: string } | null) {
    const tenantId = this.requestContext.getTenantId();
    const passwordHash = hashPassword(dto.password);
    const user = await this.database.queryOne<{ id: string }>(
      `insert into app_users (tenant_id, login_id, email, password_hash, full_name, status)
       values ($1, $2, $3, $4, $5, 'active')
       returning id`,
      [tenantId, dto.loginId, dto.email, passwordHash, dto.fullName],
    );
    if (!user) throw new Error('Unable to create user');

    for (const roleName of dto.roles || ['viewer']) {
      const role = await this.database.queryOne<{ id: string }>(
        `select id from app_roles where tenant_id = $1 and name = $2 limit 1`,
        [tenantId, roleName],
      );
      if (!role) continue;
      await this.database.query(
        `insert into app_user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`,
        [user.id, role.id],
      );
    }

    const profile = await this.database.findUserById(user.id, tenantId);
      await this.database.insertAuditLog({
      tenantId,
      actorUserId: actor?.id || null,
      entityType: 'user',
      entityId: user.id,
      action: 'created',
      afterData: { loginId: dto.loginId, email: dto.email, fullName: dto.fullName, roles: dto.roles || ['viewer'] },
    });
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: profile || user,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id/roles')
  @Permissions('users.manage')
  async setRoles(@Param('id') id: string, @Body() dto: SetUserRolesDto, @CurrentUser() actor: { id: string } | null) {
    const tenantId = this.requestContext.getTenantId();
    await this.database.query(`delete from app_user_roles where user_id = $1`, [id]);
    for (const roleName of dto.roles) {
      const role = await this.database.queryOne<{ id: string }>(
        `select id from app_roles where tenant_id = $1 and name = $2 limit 1`,
        [tenantId, roleName],
      );
      if (!role) continue;
      await this.database.query(
        `insert into app_user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`,
        [id, role.id],
      );
    }
    await this.database.insertAuditLog({
      tenantId,
      actorUserId: actor?.id || null,
      entityType: 'user',
      entityId: id,
      action: 'roles-updated',
      afterData: dto.roles,
    });
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: { userId: id, roles: dto.roles },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [UsersController],
})
export class UsersModule {}
