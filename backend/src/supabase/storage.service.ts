import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { APP_CONFIG, AppConfig } from '../config/app.config';

@Injectable()
export class SupabaseStorageService {
  private readonly client: SupabaseClient | null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.client =
      config.supabaseUrl && config.supabaseServiceRoleKey
        ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;
  }

  async upload(input: {
    tenantId: string;
    fileName: string;
    contentType: string;
    buffer: Buffer;
  }) {
    if (!this.client) {
      throw new BadRequestException('Supabase storage is not configured.');
    }

    const storagePath = `${input.tenantId}/${randomUUID()}-${input.fileName}`;
    const { error, data } = await this.client.storage
      .from(this.config.supabaseStorageBucket)
      .upload(storagePath, input.buffer, {
        contentType: input.contentType,
        upsert: false,
      });
    if (error) {
      throw new BadRequestException(error.message);
    }

    const { data: publicData } = this.client.storage
      .from(this.config.supabaseStorageBucket)
      .getPublicUrl(data.path);

    return {
      bucketName: this.config.supabaseStorageBucket,
      storagePath: data.path,
      publicUrl: publicData.publicUrl || null,
      fileName: input.fileName,
      contentType: input.contentType,
    };
  }

  async createSignedUrl(bucketName: string, storagePath: string, expiresInSeconds: number) {
    if (!this.client) {
      throw new BadRequestException('Supabase storage is not configured.');
    }
    const { data, error } = await this.client.storage.from(bucketName).createSignedUrl(storagePath, expiresInSeconds);
    if (error) {
      throw new BadRequestException(error.message);
    }
    return data;
  }
}
