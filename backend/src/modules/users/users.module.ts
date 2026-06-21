import { Body, Controller, Delete, Get, Module, NotFoundException, Param, Patch, Post, BadRequestException } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { hashPassword } from '../../common/security/password.util';
import { CreateUserDto, SetUserRolesDto, SetUserStatusDto } from './users.dto';

interface UserListRow extends QueryResultRow {
  id: string;
  login_id: string;
  email: string;
  full_name: string;
  status: string;
  created_at: string;
  roles: string[];
}

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
    const rows = await this.database.query<UserListRow>(
      `select
         u.id,
         u.login_id,
         u.email,
         u.full_name,
         u.status,
         u.created_at,
         coalesce(
           array_agg(distinct r.name) filter (where r.name is not null),
           array[]::text[]
         ) as roles
       from app_users u
       left join app_user_roles ur on ur.user_id = u.id
       left join app_roles r on r.id = ur.role_id and r.tenant_id = u.tenant_id
       where u.tenant_id = $1
       group by u.id, u.login_id, u.email, u.full_name, u.status, u.created_at
       order by u.created_at desc`,
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

  @Get('lookup')
  @Permissions('auth.read')
  async lookup() {
    const tenantId = this.requestContext.getTenantId();
    const rows = await this.database.query<{
      id: string;
      login_id: string;
      full_name: string;
      email: string;
      status: string;
    }>(
      `select id, login_id, full_name, email, status
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
    const profile = await this.database.findUserById(id, tenantId);
    if (!profile) {
      throw new NotFoundException('User not found.');
    }

    const normalizedRoles = Array.from(new Set((dto.roles || []).map((role) => role.trim().toLowerCase()).filter(Boolean)));
    const roleRows = normalizedRoles.length
      ? await this.database.query<{ id: string; name: string }>(
          `select id, name
           from app_roles
           where tenant_id = $1 and name = any($2::text[])`,
          [tenantId, normalizedRoles],
        )
      : [];

    const foundRoleNames = new Set(roleRows.map((role) => role.name));
    const invalidRoles = normalizedRoles.filter((role) => !foundRoleNames.has(role));
    if (invalidRoles.length > 0) {
      throw new BadRequestException(`Unknown roles: ${invalidRoles.join(', ')}`);
    }

    await this.database.query(
      `delete from app_user_roles
       where user_id = $1
         and role_id in (select id from app_roles where tenant_id = $2)`,
      [id, tenantId],
    );

    for (const role of roleRows) {
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
      beforeData: { roles: profile.roles },
      afterData: normalizedRoles,
    });
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: { userId: id, roles: normalizedRoles },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id/status')
  @Permissions('users.manage')
  async setStatus(@Param('id') id: string, @Body() dto: SetUserStatusDto, @CurrentUser() actor: { id: string } | null) {
    const tenantId = this.requestContext.getTenantId();
    if (actor?.id === id) {
      throw new BadRequestException('You cannot change the status of your own account.');
    }

    const profile = await this.database.findUserById(id, tenantId);
    if (!profile) {
      throw new NotFoundException('User not found.');
    }

    const updated = await this.database.queryOne<{ id: string; status: string }>(
      `update app_users
       set status = $3,
           updated_at = now()
       where id = $1 and tenant_id = $2
       returning id, status`,
      [id, tenantId, dto.status],
    );

    await this.database.insertAuditLog({
      tenantId,
      actorUserId: actor?.id || null,
      entityType: 'user',
      entityId: id,
      action: 'status-updated',
      beforeData: { status: profile.status },
      afterData: { status: dto.status },
    });

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: updated ?? { userId: id, status: dto.status },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @Permissions('users.manage')
  async remove(@Param('id') id: string, @CurrentUser() actor: { id: string } | null) {
    const tenantId = this.requestContext.getTenantId();
    if (actor?.id === id) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    const profile = await this.database.findUserById(id, tenantId);
    if (!profile) {
      throw new NotFoundException('User not found.');
    }

    await this.database.query(`delete from app_user_roles where user_id = $1`, [id]);
    await this.database.query(`delete from app_users where id = $1 and tenant_id = $2`, [id, tenantId]);

    await this.database.insertAuditLog({
      tenantId,
      actorUserId: actor?.id || null,
      entityType: 'user',
      entityId: id,
      action: 'deleted',
      beforeData: { loginId: profile.login_id, email: profile.email, fullName: profile.full_name, status: profile.status, roles: profile.roles },
    });

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: { userId: id },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [UsersController],
})
export class UsersModule {}
