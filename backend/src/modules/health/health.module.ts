import { Controller, Get, Module } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { RequestStatus } from '../../common/enums/request-status.enum';

@Controller('health')
export class HealthController {
  constructor(private readonly requestContext: RequestContextService) {}

  @Public()
  @Get()
  health() {
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: {
        ok: true,
        service: 'oodo-erp-backend',
      },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
