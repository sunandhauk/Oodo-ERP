import { IsOptional, IsString } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  data?: unknown;
}
