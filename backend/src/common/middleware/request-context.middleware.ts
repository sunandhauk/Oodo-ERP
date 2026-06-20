import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContextService } from '../context/request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: Request & { requestId?: string; tenantId?: string }, res: Response, next: NextFunction) {
    this.requestContext.run(
      {
        requestId: req.requestId || 'unknown-request',
        tenantId: req.tenantId || 'default',
        request: req,
        response: res,
      },
      next,
    );
  }
}
