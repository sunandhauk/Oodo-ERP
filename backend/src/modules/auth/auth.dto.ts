import { IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 12)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  loginId!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsString()
  @MinLength(9)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).+$/)
  password!: string;

  @IsOptional()
  @IsString({ each: true })
  roles?: string[];
}

export class LoginDto {
  @IsString()
  @Length(6, 12)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  loginId!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  portal?: 'admin' | 'user';
}
