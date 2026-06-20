import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { APP_CONFIG, AppConfig } from '../../config/app.config';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  use(req: Request & { tenantId?: string }, res: Response, next: NextFunction) {
    const headerTenantId = (req.headers['x-tenant-id'] as string | undefined)?.trim();
    const tenantId = headerTenantId || this.config.defaultTenantId;
    if (headerTenantId && headerTenantId !== this.config.defaultTenantId) {
      res.status(400).json({
        status: 'failure',
        requestId: (req as { requestId?: string }).requestId || 'unknown-request',
        data: null,
        error: {
          code: 'TENANT_MISMATCH',
          message: 'Tenant header does not match configured tenant.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    req.tenantId = tenantId;
    next();
  }
}
