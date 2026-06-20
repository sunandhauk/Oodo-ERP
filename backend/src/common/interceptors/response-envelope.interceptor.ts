import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map, catchError, throwError } from 'rxjs';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { RequestStatus } from '../enums/request-status.enum';
import { ApiEnvelope } from '../types/api-envelope.type';
import { RequestContextService } from '../context/request-context.service';
import { DatabaseService } from '../../database/database.service';

const isEnvelope = (value: unknown): value is ApiEnvelope => {
  if (!value || typeof value !== 'object') return false;
  return 'status' in value && 'requestId' in value && 'timestamp' in value;
};

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly database: DatabaseService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string; tenantId?: string; user?: { id: string } }>();
    const requestId = request.requestId || randomUUID();
    request.requestId = requestId;
    const tenantId = request.tenantId || 'default';
    const userId = request.user?.id || null;
    const requestPayload = {
      params: request.params,
      query: request.query,
      body: request.body,
    };

    void this.database.startRequestJob({
      requestId,
      tenantId,
      userId,
      method: request.method,
      path: request.path,
      requestPayload,
    });

    return next.handle().pipe(
      map((payload: unknown) => {
        const normalized = isEnvelope(payload)
          ? payload
          : {
              status: RequestStatus.Success,
              requestId,
              data: payload ?? null,
              error: null,
              timestamp: new Date().toISOString(),
            };

        void this.database.finishRequestJob(requestId, {
          status: normalized.status,
          responseStatus: normalized.status === RequestStatus.Failure ? 400 : 200,
          responsePayload: normalized,
          progressStep: normalized.status === RequestStatus.Progress ? 'queued' : 'completed',
          progressPercent: normalized.status === RequestStatus.Progress ? 10 : 100,
        });

        return normalized;
      }),
      catchError((error: Error) => {
        void this.database.finishRequestJob(requestId, {
          status: RequestStatus.Failure,
          responseStatus: 500,
          errorCode: error.name || 'INTERNAL_ERROR',
          errorMessage: error.message,
        });
        return throwError(() => error);
      }),
    );
  }
}
