import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  newPassword: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsEmail()
  email: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}
