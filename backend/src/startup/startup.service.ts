import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { APP_CONFIG, AppConfig } from '../config/app.config';
import { Inject } from '@nestjs/common';
import { hashPassword } from '../common/security/password.util';
import { SystemRole } from '../common/enums/roles.enum';

const PERMISSIONS = [
  { code: 'auth.read', description: 'Read auth profile' },
  { code: 'users.manage', description: 'Create and maintain users' },
  { code: 'master-data.manage', description: 'Maintain products and locations' },
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
      const managerRole = await this.database.seedRole(
        this.config.defaultTenantId,
        SystemRole.Manager,
        'Business workflow access',
      );
      const operatorRole = await this.database.seedRole(
        this.config.defaultTenantId,
        SystemRole.Operator,
        'Operational access',
      );
      const viewerRole = await this.database.seedRole(
        this.config.defaultTenantId,
        SystemRole.Viewer,
        'Read-only access',
      );

      await this.database.attachRolePermissions(adminRole?.id ?? '', PERMISSIONS.map((item) => item.code));
      await this.database.attachRolePermissions(managerRole?.id ?? '', [
        'auth.read',
        'master-data.manage',
        'demand.manage',
        'procurement.manage',
        'inventory.manage',
        'fulfillment.manage',
        'notifications.manage',
        'audit.read',
        'files.manage',
        'requests.read',
      ]);
      await this.database.attachRolePermissions(operatorRole?.id ?? '', [
        'auth.read',
        'demand.manage',
        'procurement.manage',
        'inventory.manage',
        'fulfillment.manage',
        'notifications.manage',
        'files.manage',
        'requests.read',
      ]);
      await this.database.attachRolePermissions(viewerRole?.id ?? '', ['auth.read', 'audit.read', 'requests.read']);

      const passwordHash = hashPassword(this.config.adminPassword);
      await this.database.createBaselineUser({
        tenantId: this.config.defaultTenantId,
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
