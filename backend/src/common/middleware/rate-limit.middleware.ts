import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { APP_CONFIG, AppConfig } from '../../config/app.config';

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, Bucket>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  use(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
    if (req.path.endsWith('/health')) {
      next();
      return;
    }

    const key = `${req.ip}:${req.method}:${req.path}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + this.config.requestRateLimitWindowMs,
      });
      next();
      return;
    }

    if (bucket.count >= this.config.requestRateLimitMax) {
      res.status(429).json({
        status: 'failure',
        requestId: req.requestId || 'unknown-request',
        data: null,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please retry later.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    bucket.count += 1;
    next();
  }
}
