import { IsOptional, IsString } from 'class-validator';

export class CreateFulfillmentDto {
  @IsOptional()
  @IsString()
  deliveryAddress?: string;
}

export class DispatchFulfillmentDto {}

export class DeliverFulfillmentDto {
  @IsOptional()
  @IsString()
  deliveredAt?: string;
}
