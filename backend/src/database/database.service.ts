import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';
import { APP_CONFIG, AppConfig } from '../config/app.config';
import { AppUserRecord, IdempotencyRecord } from './types';
import { RequestStatus } from '../common/enums/request-status.enum';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL must be set to a Supabase Postgres connection string.');
    }
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: { rejectUnauthorized: false },
    });
  }

  async onModuleInit() {
    // Database connectivity is established on demand through the pooled connection.
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  async queryOne<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  async transaction<T>(handler: (client: Pool) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await handler(client as unknown as Pool);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async ensureDefaultBaseline(tenantId: string) {
    await this.query(
      `insert into app_tenants (id, name) values ($1, $2) on conflict (id) do nothing`,
      [tenantId, 'Default Tenant'],
    );
  }

  async findUserByEmail(tenantId: string, email: string) {
    const user = await this.queryOne<{
      id: string;
      tenant_id: string;
      email: string;
      password_hash: string;
      full_name: string;
      status: string;
    }>(
      `select id, tenant_id, email, password_hash, full_name, status
       from app_users
       where tenant_id = $1 and lower(email) = lower($2)
       limit 1`,
      [tenantId, email],
    );

    return user;
  }

  async findUserById(userId: string, tenantId: string): Promise<AppUserRecord | null> {
    const user = await this.queryOne<{
      id: string;
      tenant_id: string;
      email: string;
      full_name: string;
      status: string;
    }>(
      `select id, tenant_id, email, full_name, status
       from app_users
       where id = $1 and tenant_id = $2
       limit 1`,
      [userId, tenantId],
    );

    if (!user) {
      return null;
    }

    const roles = await this.query<{ role_name: string }>(
      `select r.name as role_name
       from app_user_roles ur
       join app_roles r on r.id = ur.role_id
       where ur.user_id = $1 and r.tenant_id = $2`,
      [userId, tenantId],
    );

    const permissions = await this.query<{ permission_code: string }>(
      `select p.code as permission_code
       from app_user_roles ur
       join app_roles r on r.id = ur.role_id
       join app_role_permissions rp on rp.role_id = r.id
       join app_permissions p on p.id = rp.permission_id
       where ur.user_id = $1 and r.tenant_id = $2`,
      [userId, tenantId],
    );

    return {
      id: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      full_name: user.full_name,
      status: user.status,
      roles: roles.map((item) => item.role_name),
      permissions: permissions.map((item) => item.permission_code),
    };
  }

  async findIdempotencyRecord(
    tenantId: string,
    method: string,
    path: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRecord | null> {
    return this.queryOne<IdempotencyRecord>(
      `select id, tenant_id, method, path, idempotency_key, request_hash, response_status, response_payload
       from app_idempotency_keys
       where tenant_id = $1 and method = $2 and path = $3 and idempotency_key = $4
       order by created_at desc
       limit 1`,
      [tenantId, method, path, idempotencyKey],
    );
  }

  async upsertIdempotencyRecord(input: {
    tenantId: string;
    method: string;
    path: string;
    idempotencyKey: string;
    requestHash: string;
    expiresAt: Date;
  }) {
    await this.query(
      `insert into app_idempotency_keys (
        tenant_id, method, path, idempotency_key, request_hash, expires_at
      ) values ($1, $2, $3, $4, $5, $6)
      on conflict (tenant_id, method, path, idempotency_key)
      do update set request_hash = excluded.request_hash, expires_at = excluded.expires_at`,
      [input.tenantId, input.method, input.path, input.idempotencyKey, input.requestHash, input.expiresAt],
    );
  }

  async saveIdempotencyResponse(input: {
    tenantId: string;
    method: string;
    path: string;
    idempotencyKey: string;
    responseStatus: number;
    responsePayload: unknown;
  }) {
    await this.query(
      `update app_idempotency_keys
       set response_status = $5,
           response_payload = $6
       where tenant_id = $1 and method = $2 and path = $3 and idempotency_key = $4`,
      [
        input.tenantId,
        input.method,
        input.path,
        input.idempotencyKey,
        input.responseStatus,
        input.responsePayload as never,
      ],
    );
  }

  async startRequestJob(input: {
    requestId: string;
    tenantId: string;
    userId: string | null;
    method: string;
    path: string;
    requestPayload: unknown;
  }) {
    await this.query(
      `insert into app_request_jobs (
        request_id, tenant_id, user_id, method, path, status, progress_step, progress_percent, request_payload
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (request_id) do update set
        status = excluded.status,
        request_payload = excluded.request_payload`,
      [
        input.requestId,
        input.tenantId,
        input.userId,
        input.method,
        input.path,
        RequestStatus.Progress,
        'started',
        5,
        input.requestPayload as never,
      ],
    );
  }

  async finishRequestJob(
    requestId: string,
    input: {
      status: RequestStatus;
      responseStatus: number;
      responsePayload?: unknown;
      progressStep?: string;
      progressPercent?: number;
      errorCode?: string;
      errorMessage?: string;
    },
  ) {
    await this.query(
      `update app_request_jobs
       set status = $2,
           response_status = $3,
           response_payload = coalesce($4, response_payload),
           progress_step = coalesce($5, progress_step),
           progress_percent = coalesce($6, progress_percent),
           error_code = $7,
           error_message = $8,
           finished_at = case when $2 in ('success', 'failure') then now() else finished_at end
       where request_id = $1`,
      [
        requestId,
        input.status,
        input.responseStatus,
        input.responsePayload as never,
        input.progressStep ?? null,
        input.progressPercent ?? null,
        input.errorCode ?? null,
        input.errorMessage ?? null,
      ],
    );
  }

  async getRequestJob(requestId: string) {
    return this.queryOne<{
      id: string;
      request_id: string;
      tenant_id: string;
      user_id: string | null;
      method: string;
      path: string;
      status: RequestStatus;
      progress_step: string | null;
      progress_percent: number;
      response_status: number | null;
      request_payload: unknown;
      response_payload: unknown;
      error_code: string | null;
      error_message: string | null;
      started_at: string;
      finished_at: string | null;
    }>(`select * from app_request_jobs where request_id = $1 limit 1`, [requestId]);
  }

  async insertAuditLog(input: {
    tenantId: string;
    actorUserId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    beforeData?: unknown;
    afterData?: unknown;
    meta?: unknown;
  }) {
    await this.query(
      `insert into app_audit_logs (
        tenant_id, actor_user_id, entity_type, entity_id, action, before_data, after_data, meta
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.tenantId,
        input.actorUserId,
        input.entityType,
        input.entityId,
        input.action,
        input.beforeData as never,
        input.afterData as never,
        input.meta as never,
      ],
    );
  }

  async seedPermissions(codes: Array<{ code: string; description: string }>) {
    for (const permission of codes) {
      await this.query(
        `insert into app_permissions (code, description)
         values ($1, $2)
         on conflict (code) do update set description = excluded.description`,
        [permission.code, permission.description],
      );
    }
  }

  async seedRole(tenantId: string, name: string, description: string) {
    const role = await this.queryOne<{ id: string }>(
      `insert into app_roles (tenant_id, name, description)
       values ($1, $2, $3)
       on conflict (tenant_id, name)
       do update set description = excluded.description
       returning id`,
      [tenantId, name, description],
    );
    return role;
  }

  async attachRolePermissions(roleId: string, permissionCodes: string[]) {
    for (const code of permissionCodes) {
      const permission = await this.queryOne<{ id: string }>(
        `select id from app_permissions where code = $1 limit 1`,
        [code],
      );
      if (!permission) continue;
      await this.query(
        `insert into app_role_permissions (role_id, permission_id)
         values ($1, $2)
         on conflict (role_id, permission_id) do nothing`,
        [roleId, permission.id],
      );
    }
  }

  async createBaselineUser(input: {
    tenantId: string;
    email: string;
    passwordHash: string;
    fullName: string;
    roleNames: string[];
  }) {
    const user = await this.queryOne<{ id: string }>(
      `insert into app_users (tenant_id, email, password_hash, full_name, status)
       values ($1, $2, $3, $4, 'active')
       on conflict (tenant_id, email)
       do update set password_hash = excluded.password_hash, full_name = excluded.full_name
       returning id`,
      [input.tenantId, input.email, input.passwordHash, input.fullName],
    );
    if (!user) {
      throw new Error('Unable to seed baseline user');
    }

    for (const roleName of input.roleNames) {
      const role = await this.queryOne<{ id: string }>(
        `select id from app_roles where tenant_id = $1 and name = $2 limit 1`,
        [input.tenantId, roleName],
      );
      if (!role) continue;
      await this.query(
        `insert into app_user_roles (user_id, role_id)
         values ($1, $2)
         on conflict (user_id, role_id) do nothing`,
        [user.id, role.id],
      );
    }

    return user.id;
  }
}
