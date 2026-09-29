import { IsString, IsOptional, IsIn, IsArray, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSurveyDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  waterBodyId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  waterBodyName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty({ required: false, enum: ['LIVE', 'HISTORICAL'] })
  @IsOptional()
  @IsIn(['LIVE', 'HISTORICAL'])
  dataType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  historicalSource?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  surveyDate?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  assignedOperators?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  startLat?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  startLon?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  endLat?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  endLon?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  depthMeters?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  route?: any;
}
