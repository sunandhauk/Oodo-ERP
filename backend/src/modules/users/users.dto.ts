import { IsArray, IsEmail, IsIn, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Length(6, 12)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  loginId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  fullName!: string;

  @IsString()
  @MinLength(9)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).+$/)
  password!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}

export class SetUserRolesDto {
  @IsArray()
  @IsString({ each: true })
  roles!: string[];
}

export class SetUserStatusDto {
  @IsString()
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}
