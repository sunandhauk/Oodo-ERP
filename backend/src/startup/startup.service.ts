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
];

@Injectable()
export class StartupService implements OnApplicationBootstrap {
  constructor(
    private readonly database: DatabaseService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.database.ensureDefaultBaseline(this.config.defaultTenantId);
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
      ]);
      await this.database.attachRolePermissions(viewerRole?.id ?? '', [
        'auth.read',
        'sales.view',
        'purchase.view',
        'manufacturing.view',
        'product.view',
        'audit.read',
        'requests.read',
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown startup error';
      console.warn(`[startup] skipped database seeding: ${message}`);
    }
  }
}
