import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { TenderStatus } from '../../generated/prisma/client.js';
import { PageQueryDto } from '../../common/pagination/pagination.js';
import { MoneyDto, TenderTranslationDto } from './tender-input.dto.js';

// The scoring set at acceptance: each value 0–100, the weights adding up to
// 100 (ERD, Scoring and award).
export class ScoringDto {
  @ApiProperty({ example: 70 })
  @IsInt()
  @Min(0)
  @Max(100)
  technicalWeight: number;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(0)
  @Max(100)
  financialWeight: number;

  @ApiProperty({ example: 60 })
  @IsInt()
  @Min(0)
  @Max(100)
  minimumTechnicalScore: number;
}

// M3: accept a draft and set its scoring.
export class AcceptTenderDto extends ScoringDto {
  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  revision: number;
}

// M4: edit an accepted tender's details and scoring. Omitted fields stay.
export class UpdateManagedTenderDto {
  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  revision: number;

  @ApiPropertyOptional({ example: 'construction' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryCode?: string;

  @ApiPropertyOptional({ type: MoneyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  estimatedBalance?: MoneyDto;

  @ApiPropertyOptional({ type: [TenderTranslationDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => TenderTranslationDto)
  translations?: TenderTranslationDto[];

  @ApiPropertyOptional({ type: ScoringDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScoringDto)
  scoring?: ScoringDto;
}

export class DeadlinesDto {
  @ApiProperty({ example: '2026-12-10T12:00:00Z' })
  @IsDateString({ strict: true })
  application: string;

  @ApiProperty({ example: '2026-12-17T12:00:00Z' })
  @IsDateString({ strict: true })
  technical: string;

  @ApiProperty({ example: '2026-12-24T12:00:00Z' })
  @IsDateString({ strict: true })
  financial: string;
}

// M8: publish with the three deadlines, application → technical → financial,
// all in the future (ENGINEERING_STANDARDS.md §2.7).
export class PublishTenderDto {
  @ApiProperty({ example: 6 })
  @IsInt()
  @Min(1)
  revision: number;

  @ApiProperty({ example: 'construction' })
  @IsString()
  @IsNotEmpty()
  categoryCode: string;

  @ApiProperty({ type: DeadlinesDto })
  @ValidateNested()
  @Type(() => DeadlinesDto)
  deadlines: DeadlinesDto;
}

// M5: the non-file fields of a Terms of Reference upload (multipart).
export class UploadTenderDocumentDto {
  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  revision: number;

  @ApiProperty({ enum: ['terms_of_reference', 'other'], example: 'terms_of_reference' })
  @IsIn(['terms_of_reference', 'other'])
  kind: 'terms_of_reference' | 'other';

  @ApiProperty({ example: 'ar', description: 'ISO 639-1 code of the file language' })
  @Matches(/^[a-z]{2}$/)
  language: string;

  @ApiPropertyOptional({ description: 'The original, when uploading a translated copy' })
  @IsOptional()
  @IsUUID()
  translationOf?: string;
}

export class RemoveDocumentQueryDto {
  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  revision: number;
}

export class ManagedTenderQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: TenderStatus, enumName: 'TenderStatus' })
  @IsOptional()
  @IsEnum(TenderStatus)
  status?: TenderStatus;
}
