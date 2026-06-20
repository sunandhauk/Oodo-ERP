import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string }, _res: Response, next: NextFunction) {
    req.requestId = (req.headers['x-request-id'] as string) || randomUUID();
    next();
  }
}
