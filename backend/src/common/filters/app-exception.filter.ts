import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { RequestStatus } from '../enums/request-status.enum';
import { RequestContextService } from '../context/request-context.service';
import { DatabaseService } from '../../database/database.service';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly database: DatabaseService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const res = ctx.getResponse<Response>();
    const requestId = req.requestId || this.requestContext.getRequestId();

    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const responseBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : {
            message: exception instanceof Error ? exception.message : 'Unexpected error',
          };

    const errorPayload = {
      status: RequestStatus.Failure,
      requestId,
      data: null,
      error: {
        code: exception instanceof HttpException ? `HTTP_${statusCode}` : 'INTERNAL_ERROR',
        message:
          typeof responseBody === 'string'
            ? responseBody
            : (responseBody as { message?: string }).message || 'Request failed.',
        details: responseBody,
      },
      timestamp: new Date().toISOString(),
    };

    void this.database.finishRequestJob(requestId, {
      status: RequestStatus.Failure,
      responseStatus: statusCode,
      responsePayload: errorPayload,
      errorCode: errorPayload.error.code,
      errorMessage: errorPayload.error.message,
    });

    res.status(statusCode).json(errorPayload);
  }
}
