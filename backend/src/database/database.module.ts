import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { RequestContextService } from '../common/context/request-context.service';
import { appConfigProvider } from '../config/app.config';

@Global()
@Module({
  providers: [appConfigProvider, RequestContextService, DatabaseService],
  exports: [DatabaseService, RequestContextService],
})
export class DatabaseModule {}
