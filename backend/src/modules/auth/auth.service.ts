import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { hashPassword, verifyPassword } from '../../common/security/password.util';
import { signJwt } from '../../common/security/jwt.util';
import { APP_CONFIG, AppConfig } from '../../config/app.config';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { RequestContextService } from '../../common/context/request-context.service';
import { AppUserRecord } from '../../database/types';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private signAccessToken(profile: AppUserRecord) {
    return signJwt(
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
  }

  private buildSessionResponse(profile: AppUserRecord) {
    const accessToken = this.signAccessToken(profile);

    return {
      accessToken,
      user: profile,
    };
  }

  private isValidPassword(password: string, loginId: string, email: string) {
    if (password.length < 9) {
      return false;
    }

    if (!/(?=.*[a-z])/.test(password)) {
      return false;
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      return false;
    }

    if (!/(?=.*[^A-Za-z0-9])/.test(password)) {
      return false;
    }

    const normalizedPassword = password.trim().toLowerCase();
    const normalizedLoginId = loginId.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedPassword === normalizedLoginId || normalizedPassword === normalizedEmail) {
      return false;
    }

    return true;
  }

  async register(dto: RegisterDto) {
    const tenantId = this.requestContext.getTenantId();
    const email = dto.email.trim();
    const loginId = dto.loginId.trim();
    const fullName = dto.fullName?.trim() || loginId;

    if (loginId.length < 6 || loginId.length > 12) {
      throw new BadRequestException('Login ID must be between 6 and 12 characters.');
    }

    if (!this.isValidPassword(dto.password, loginId, email)) {
      throw new BadRequestException(
        'Password must be at least 9 characters and include lowercase, uppercase, and a special character.',
      );
    }

    const existingLoginId = await this.database.findUserByLoginId(tenantId, loginId);
    if (existingLoginId) {
      throw new BadRequestException('Login ID already exists.');
    }

    const existingEmail = await this.database.findUserByEmail(tenantId, email);
    if (existingEmail) {
      throw new BadRequestException('Email already exists.');
    }

    const passwordHash = hashPassword(dto.password);
    const user = await this.database.queryOne<{ id: string; email: string; login_id: string; full_name: string }>(
      `insert into app_users (tenant_id, login_id, email, password_hash, full_name, status)
       values ($1, $2, $3, $4, $5, 'active')
       returning id, email, login_id, full_name`,
      [tenantId, loginId, email, passwordHash, fullName],
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
    if (!profile) {
      throw new BadRequestException('Unable to load the created user profile.');
    }

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: this.buildSessionResponse(profile),
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  async login(dto: LoginDto) {
    const tenantId = this.requestContext.getTenantId();
    const loginId = dto.loginId.trim();
    const user = await this.database.findUserByLoginId(tenantId, loginId);
    if (!user || !verifyPassword(dto.password, user.password_hash)) {
      throw new UnauthorizedException('Invalid Login Id or Password');
    }

    const profile = await this.database.findUserById(user.id, tenantId);
    if (!profile) {
      throw new UnauthorizedException('User profile is unavailable.');
    }

    const roleSet = new Set(profile.roles.map((role) => role.toLowerCase()));
    if (dto.portal === 'admin' && !roleSet.has('admin')) {
      throw new UnauthorizedException('Invalid Login Id or Password');
    }

    if (dto.portal === 'user' && roleSet.has('admin')) {
      throw new UnauthorizedException('Invalid Login Id or Password');
    }

    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: this.buildSessionResponse(profile),
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}
