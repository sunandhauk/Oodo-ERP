import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { APP_CONFIG, AppConfig } from '../../config/app.config';
import { DatabaseService } from '../../database/database.service';
import { AppUserRecord } from '../../database/types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { verifyJwt } from '../security/jwt.util';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly database: DatabaseService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AppUserRecord; tenantId?: string }>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authorization.slice('Bearer '.length);
    const payload = verifyJwt(token, this.config.jwtSecret);
    if ((request.tenantId || this.config.defaultTenantId) !== payload.tenantId) {
      throw new UnauthorizedException('Token tenant does not match request tenant.');
    }

    const user = await this.database.findUserById(payload.sub, payload.tenantId);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User is inactive or missing.');
    }

    request.user = user;
    request.user.roles = user.roles;
    request.user.permissions = user.permissions;

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]) ?? [];
    const permissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];

    if (roles.length > 0) {
      const hasRole = roles.some((role) => user.roles.includes(role));
      if (!hasRole) {
        throw new ForbiddenException('Required role is missing.');
      }
    }

    if (permissions.length > 0) {
      const hasPermission = permissions.every((permission) => user.permissions.includes(permission));
      if (!hasPermission) {
        throw new ForbiddenException('Required permission is missing.');
      }
    }

    return true;
  }
}
