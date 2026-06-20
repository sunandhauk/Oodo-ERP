import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { hashPassword, verifyPassword } from '../../common/security/password.util';
import { signJwt } from '../../common/security/jwt.util';
import { APP_CONFIG, AppConfig } from '../../config/app.config';
import { Inject } from '@nestjs/common';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { RequestContextService } from '../../common/context/request-context.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(dto: { email: string; password: string; fullName: string; roles?: string[] }) {
    const tenantId = this.requestContext.getTenantId();
    const existing = await this.database.findUserByEmail(tenantId, dto.email);
    if (existing) {
      throw new BadRequestException('Email is already registered.');
    }

    const passwordHash = hashPassword(dto.password);
    const user = await this.database.queryOne<{ id: string; email: string; full_name: string }>(
      `insert into app_users (tenant_id, email, password_hash, full_name, status)
       values ($1, $2, $3, $4, 'active')
       returning id, email, full_name`,
      [tenantId, dto.email, passwordHash, dto.fullName],
    );
    if (!user) {
      throw new BadRequestException('Unable to create user.');
    }

    const roleNames = dto.roles?.length ? dto.roles : ['viewer'];
    for (const roleName of roleNames) {
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

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: profile || user,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  async login(dto: { email: string; password: string }) {
    const tenantId = this.requestContext.getTenantId();
    const user = await this.database.findUserByEmail(tenantId, dto.email);
    if (!user || !verifyPassword(dto.password, user.password_hash)) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const profile = await this.database.findUserById(user.id, tenantId);
    if (!profile) {
      throw new UnauthorizedException('User profile is unavailable.');
    }

    const token = signJwt(
      {
        sub: profile.id,
        tenantId: profile.tenant_id,
        email: profile.email,
        roles: profile.roles,
        permissions: profile.permissions,
      },
      this.config.jwtSecret,
      this.config.jwtTtlSeconds,
    );

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: {
        accessToken: token,
        user: profile,
      },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}
