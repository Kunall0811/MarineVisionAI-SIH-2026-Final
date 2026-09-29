import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({ required: false, enum: ['ADMIN', 'OPERATOR'] })
  @IsOptional()
  @IsIn(['OPERATOR']) // Public self-registration can only ever create OPERATOR accounts.
  role?: 'OPERATOR';
}
