import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { InventoryMovementType } from '../../common/enums/workflow-status.enum';

export class CreateInventoryMovementDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsEnum(InventoryMovementType)
  movementType!: InventoryMovementType;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}
