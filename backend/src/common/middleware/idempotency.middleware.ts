import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { createHash } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { APP_CONFIG, AppConfig } from '../../config/app.config';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(
    private readonly database: DatabaseService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async use(req: Request & { requestId?: string; tenantId?: string }, res: Response, next: NextFunction) {
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      next();
      return;
    }

    const idempotencyKey = (req.headers['idempotency-key'] as string | undefined)?.trim();
    if (!idempotencyKey) {
      next();
      return;
    }

    const tenantId = req.tenantId || this.config.defaultTenantId;
    const path = req.path;
    const requestHash = createHash('sha256').update(JSON.stringify(req.body ?? {})).digest('hex');
    const existing = await this.database.findIdempotencyRecord(tenantId, method, path, idempotencyKey);

    if (existing && existing.request_hash !== requestHash) {
      res.status(409).json({
        status: 'failure',
        requestId: req.requestId || 'unknown-request',
        data: null,
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'The same idempotency key was used with a different payload.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (existing && existing.request_hash === requestHash && existing.response_payload) {
      res.status(existing.response_status || 200).json(existing.response_payload);
      return;
    }

    if (!existing) {
      const expiresAt = new Date(Date.now() + this.config.idempotencyTtlSeconds * 1000);
      await this.database.upsertIdempotencyRecord({
        tenantId,
        method,
        path,
        idempotencyKey,
        requestHash,
        expiresAt,
      });
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      void this.database.saveIdempotencyResponse({
        tenantId,
        method,
        path,
        idempotencyKey,
        responseStatus: res.statusCode,
        responsePayload: body,
      });
      return originalJson(body);
    }) as Response['json'];

    next();
  }
}
