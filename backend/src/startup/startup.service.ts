import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { APP_CONFIG, AppConfig } from '../config/app.config';
import { Inject } from '@nestjs/common';
import { hashPassword } from '../common/security/password.util';
import { SystemRole } from '../common/enums/roles.enum';

const PERMISSIONS = [
  { code: 'auth.read', description: 'Read auth profile' },
  { code: 'users.manage', description: 'Create and maintain users' },
  { code: 'sales.view', description: 'View sales records' },
  { code: 'sales.create', description: 'Create sales records' },
  { code: 'sales.edit', description: 'Edit sales records' },
  { code: 'sales.delete', description: 'Delete sales records' },
  { code: 'sales.approve', description: 'Approve or confirm sales records' },
  { code: 'purchase.view', description: 'View purchase records' },
  { code: 'purchase.create', description: 'Create purchase records' },
  { code: 'purchase.edit', description: 'Edit purchase records' },
  { code: 'purchase.delete', description: 'Delete purchase records' },
  { code: 'purchase.approve', description: 'Approve purchase records' },
  { code: 'manufacturing.view', description: 'View manufacturing records' },
  { code: 'manufacturing.production-entry', description: 'Enter production details' },
  { code: 'manufacturing.edit-bom', description: 'Edit bills of materials' },
  { code: 'product.view', description: 'View products' },
  { code: 'product.create', description: 'Create products' },
  { code: 'product.edit', description: 'Edit products' },
  { code: 'master-data.manage', description: 'Maintain locations and master data' },
  { code: 'demand.manage', description: 'Create and approve demand' },
  { code: 'procurement.manage', description: 'Create and receive procurements' },
  { code: 'inventory.manage', description: 'Create inventory movements' },
  { code: 'fulfillment.manage', description: 'Manage fulfillment and delivery' },
  { code: 'notifications.manage', description: 'Create and read notifications' },
  { code: 'audit.read', description: 'Read audit logs' },
  { code: 'files.manage', description: 'Upload and manage files' },
  { code: 'requests.read', description: 'Read request job status' },
  { code: 'dashboard.read', description: 'Read dashboard summary' },
];

@Injectable()
export class StartupService implements OnApplicationBootstrap {
  constructor(
    private readonly database: DatabaseService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.SKIP_STARTUP_SEED === 'true') {
      return;
    }

    try {
      await this.seedBaseline();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown startup error';
      console.warn(`[startup] skipped database seeding: ${message}`);
    }
  }

  async seedBaseline() {
    await this.database.ensureDefaultBaseline(this.config.defaultTenantId);
    await this.database.query(
      `create table if not exists app_sales_orders (
           id uuid primary key default gen_random_uuid(),
           tenant_id text not null references app_tenants(id) on delete cascade,
           reference_no text not null,
           customer text not null,
           salesperson text not null,
           address text not null,
           status text not null default 'Draft',
           order_date date not null default current_date,
           order_time text not null default to_char(now(), 'HH12:MI AM'),
           created_at timestamptz not null default now(),
           updated_at timestamptz not null default now(),
           unique (tenant_id, reference_no)
         );

         create table if not exists app_sales_order_lines (
           id uuid primary key default gen_random_uuid(),
           sales_order_id uuid not null references app_sales_orders(id) on delete cascade,
           product_name text not null,
           availability text not null default 'In Stock',
           ordered_quantity numeric(14, 3) not null,
           delivered_quantity numeric(14, 3) not null default 0,
           units text not null default 'Nos',
           unit_price numeric(14, 3) not null default 0,
           created_at timestamptz not null default now()
         );

         create table if not exists app_manufacturing_orders (
           id uuid primary key default gen_random_uuid(),
           tenant_id text not null references app_tenants(id) on delete cascade,
           reference_no text not null,
           finished_product text not null,
           assignee text not null,
           status text not null default 'Draft',
           component_status text not null default 'Available',
           quantity numeric(14, 3) not null default 1,
           unit text not null default 'Units',
           schedule_date date not null default current_date,
           bill_of_material text not null,
           order_date date not null default current_date,
           order_time text not null default to_char(now(), 'HH12:MI AM'),
           created_at timestamptz not null default now(),
           updated_at timestamptz not null default now(),
           unique (tenant_id, reference_no)
         );

         create table if not exists app_manufacturing_order_components (
           id uuid primary key default gen_random_uuid(),
           manufacturing_order_id uuid not null references app_manufacturing_orders(id) on delete cascade,
           component text not null,
           availability text not null default 'Available',
           to_consume_units numeric(14, 3) not null,
           consume_units numeric(14, 3) not null default 0,
           unit_cost numeric(14, 3) not null default 0,
           created_at timestamptz not null default now()
         );

         create table if not exists app_manufacturing_work_orders (
           id uuid primary key default gen_random_uuid(),
           manufacturing_order_id uuid not null references app_manufacturing_orders(id) on delete cascade,
           operation text not null,
           assignee text not null,
           planned_hours numeric(14, 3) not null,
           real_hours numeric(14, 3) not null default 0,
           status text not null default 'Pending',
           created_at timestamptz not null default now()
         );

         create table if not exists app_boms (
           id uuid primary key default gen_random_uuid(),
           tenant_id text not null references app_tenants(id) on delete cascade,
           reference_no text not null,
           finished_product text not null,
           quantity numeric(14, 3) not null default 1,
           unit text not null default 'Units',
           alternative text not null default '',
           attached_log text not null default '',
           status text not null default 'Draft',
           created_at timestamptz not null default now(),
           updated_at timestamptz not null default now(),
           unique (tenant_id, reference_no)
         );

         create table if not exists app_bom_components (
           id uuid primary key default gen_random_uuid(),
           bom_id uuid not null references app_boms(id) on delete cascade,
           component text not null,
           availability text not null default 'Available',
           to_consume_units numeric(14, 3) not null,
           consume_units numeric(14, 3) not null default 0,
           created_at timestamptz not null default now()
         );

         create table if not exists app_bom_work_orders (
           id uuid primary key default gen_random_uuid(),
           bom_id uuid not null references app_boms(id) on delete cascade,
           operation text not null,
           assignee text not null,
           planned_hours numeric(14, 3) not null,
           status text not null default 'Pending',
           created_at timestamptz not null default now()
         );`,
    );
    await this.database.query(
      `alter table app_products
         add column if not exists sales_price numeric(14, 3) not null default 0,
         add column if not exists cost_price numeric(14, 3) not null default 0,
         add column if not exists on_hand_qty numeric(14, 3) not null default 0,
         add column if not exists category text not null default 'General',
         add column if not exists image_url text,
         add column if not exists procure_on_demand boolean not null default false,
         add column if not exists procure_source text,
         add column if not exists minimum_qty numeric(14, 3) not null default 0,
         add column if not exists free_to_use_qty numeric(14, 3) not null default 0,
         add column if not exists vendor_name text not null default '',
         add column if not exists bom_reference text not null default ''`,
    );
    await this.database.query(
      `alter table app_manufacturing_work_orders
         add column if not exists real_hours numeric(14, 3) not null default 0`,
    );
    await this.database.seedPermissions(PERMISSIONS);

    const adminRole = await this.database.seedRole(
      this.config.defaultTenantId,
      SystemRole.Admin,
      'Full access to the ERP backend',
    );
    const userRole = await this.database.seedRole(
      this.config.defaultTenantId,
      SystemRole.User,
      'Business workflow access',
    );
    const viewerRole = await this.database.seedRole(
      this.config.defaultTenantId,
      SystemRole.Viewer,
      'Read-only access',
    );

    await this.database.attachRolePermissions(adminRole?.id ?? '', PERMISSIONS.map((item) => item.code));
    await this.database.attachRolePermissions(userRole?.id ?? '', [
      'auth.read',
      'sales.view',
      'sales.create',
      'sales.edit',
      'purchase.view',
      'purchase.create',
      'purchase.edit',
      'manufacturing.view',
      'manufacturing.production-entry',
      'product.view',
      'product.create',
      'product.edit',
      'notifications.manage',
      'files.manage',
      'requests.read',
      'dashboard.read',
    ]);
    await this.database.attachRolePermissions(viewerRole?.id ?? '', [
      'auth.read',
      'sales.view',
      'purchase.view',
      'manufacturing.view',
      'product.view',
      'audit.read',
      'requests.read',
      'dashboard.read',
    ]);

    const passwordHash = hashPassword(this.config.adminPassword);
    await this.database.createBaselineUser({
      tenantId: this.config.defaultTenantId,
      loginId: this.config.adminLoginId,
      email: this.config.adminEmail,
      passwordHash,
      fullName: this.config.adminName,
      roleNames: [SystemRole.Admin],
    });
  }
}
