import { Controller, Get, Module, Param } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { DatabaseService } from '../../database/database.service';
import { RequestStatus } from '../../common/enums/request-status.enum';

@Controller('requests')
export class RequestStatusController {
  constructor(
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get(':requestId')
  @Permissions('requests.read')
  async getStatus(@Param('requestId') requestId: string) {
    const row = await this.database.getRequestJob(requestId);
    return {
      status: row?.status || RequestStatus.Failure,
      requestId: this.requestContext.getRequestId(),
      data: row,
      error: row
        ? null
        : {
            code: 'REQUEST_NOT_FOUND',
            message: 'Request job was not found.',
          },
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [RequestStatusController],
})
export class RequestStatusModule {}
