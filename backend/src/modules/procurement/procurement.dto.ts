import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProcurementFromDemandDto {
  @IsString()
  @MinLength(1)
  supplierName!: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;
}

export class ReceiveProcurementDto {
  @IsOptional()
  @IsDateString()
  receivedAt?: string;
}
