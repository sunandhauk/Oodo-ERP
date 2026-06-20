import { Controller, Get, Module, Param, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContextService } from '../../common/context/request-context.service';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { DatabaseService } from '../../database/database.service';
import { SupabaseStorageService } from '../../supabase/storage.service';

@Controller('files')
export class FilesController {
  constructor(
    private readonly storage: SupabaseStorageService,
    private readonly database: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post('upload')
  @Permissions('files.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: { id: string } | null,
  ) {
    if (!file) {
      throw new BadRequestException('File is required.');
    }
    const allowedTypes = new Set([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    if (!allowedTypes.has(file.mimetype)) {
      throw new BadRequestException('Unsupported file type.');
    }
    const tenantId = this.requestContext.getTenantId();
    const uploaded = await this.storage.upload({
      tenantId,
      fileName: file.originalname,
      contentType: file.mimetype,
      buffer: file.buffer,
    });
    const row = await this.database.queryOne<{ id: string }>(
      `insert into app_attachments (
        tenant_id, entity_type, entity_id, bucket_name, file_name, content_type, storage_path, public_url, created_by
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning id`,
      [
        tenantId,
        'generic',
        'pending',
        uploaded.bucketName,
        uploaded.fileName,
        uploaded.contentType,
        uploaded.storagePath,
        uploaded.publicUrl || null,
        user?.id || null,
      ],
    );
    await this.database.insertAuditLog({
      tenantId,
      actorUserId: user?.id || null,
      entityType: 'attachment',
      entityId: row?.id || uploaded.storagePath,
      action: 'uploaded',
      afterData: uploaded,
    });
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: { attachmentId: row?.id, ...uploaded },
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/signed-url')
  @Permissions('files.manage')
  async signedUrl(@Param('id') id: string) {
    const attachment = await this.database.queryOne<{ storage_path: string; bucket_name: string }>(
      `select storage_path, bucket_name from app_attachments where id = $1 limit 1`,
      [id],
    );
    if (!attachment) {
      throw new BadRequestException('Attachment not found.');
    }
    const url = await this.storage.createSignedUrl(attachment.bucket_name, attachment.storage_path, 3600);
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: url,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [FilesController],
})
export class FilesModule {}
