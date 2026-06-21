import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { StartupService } from '../startup/startup.service';
import { StartupModule } from '../startup/startup.module';

@Module({
  imports: [DatabaseModule, StartupModule],
})
class SeedModule {}

async function bootstrap() {
  process.env.SKIP_STARTUP_SEED = 'true';

  const app = await NestFactory.createApplicationContext(SeedModule, {
    bufferLogs: true,
  });

  try {
    const startup = app.get(StartupService);
    await startup.seedBaseline();
    // eslint-disable-next-line no-console
    console.log('Admin seed completed successfully.');
  } finally {
    await app.close();
  }
}

void bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Admin seed failed.');
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
