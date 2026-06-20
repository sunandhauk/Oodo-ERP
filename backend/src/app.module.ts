import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { appConfigProvider } from './config/app.config';
import { AccessGuard } from './common/guards/access.guard';
import { AppExceptionFilter } from './common/filters/app-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { IdempotencyMiddleware } from './common/middleware/idempotency.middleware';
import { DatabaseModule } from './database/database.module';
import { SupabaseModule } from './supabase/supabase.module';
import { StartupModule } from './startup/startup.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { DemandModule } from './modules/demand/demand.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { FulfillmentModule } from './modules/fulfillment/fulfillment.module';
import { FilesModule } from './modules/files/files.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { RequestStatusModule } from './modules/request-status/request-status.module';

@Module({
  imports: [
    DatabaseModule,
    SupabaseModule,
    StartupModule,
    HealthModule,
    AuthModule,
    UsersModule,
    MasterDataModule,
    DemandModule,
    ProcurementModule,
    InventoryModule,
    FulfillmentModule,
    FilesModule,
    NotificationsModule,
    AuditModule,
    RequestStatusModule,
  ],
  providers: [
    appConfigProvider,
    {
      provide: APP_GUARD,
      useClass: AccessGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware, TenantMiddleware, RequestContextMiddleware, RateLimitMiddleware, IdempotencyMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
