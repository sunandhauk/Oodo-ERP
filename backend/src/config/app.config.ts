import { Provider } from '@nestjs/common';

export interface AppConfig {
  appName: string;
  nodeEnv: string;
  port: number;
  defaultTenantId: string;
  jwtSecret: string;
  jwtTtlSeconds: number;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbDatabase: string;
  dbSsl: boolean;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseStorageBucket: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  requestRateLimitWindowMs: number;
  requestRateLimitMax: number;
  idempotencyTtlSeconds: number;
  maxUploadSizeBytes: number;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

const toInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value: string | undefined, fallback = false) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

export const buildAppConfig = (): AppConfig => ({
  appName: process.env.APP_NAME || 'Oodo ERP',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),
  defaultTenantId: process.env.DEFAULT_TENANT_ID || 'default',
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  jwtTtlSeconds: toInt(process.env.JWT_TTL_SECONDS, 86400),
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: toInt(process.env.DB_PORT, 5432),
  dbUser: process.env.DB_USER || 'postgres',
  dbPassword: process.env.DB_PASSWORD || 'postgres',
  dbDatabase: process.env.DB_DATABASE || 'oodo_erp',
  dbSsl: toBool(process.env.DB_SSL, false),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'erp-files',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@oodo.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
  adminName: process.env.ADMIN_NAME || 'System Admin',
  requestRateLimitWindowMs: toInt(process.env.REQUEST_RATE_LIMIT_WINDOW_MS, 60000),
  requestRateLimitMax: toInt(process.env.REQUEST_RATE_LIMIT_MAX, 120),
  idempotencyTtlSeconds: toInt(process.env.IDEMPOTENCY_TTL_SECONDS, 86400),
  maxUploadSizeBytes: toInt(process.env.MAX_UPLOAD_SIZE_BYTES, 10 * 1024 * 1024),
});

export const appConfigProvider: Provider = {
  provide: APP_CONFIG,
  useFactory: buildAppConfig,
};
