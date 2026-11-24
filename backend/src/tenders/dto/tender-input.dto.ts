import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Language } from '../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// A decimal string plus a currency (API_CONTRACT.md §1.6).
export class MoneyDto {
  @ApiProperty({ example: '125000.00' })
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/)
  amount: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency: string;
}

// A translation needs both a title and a description (ERD, Language).
export class TenderTranslationDto {
  @ApiProperty({ enum: Language, enumName: 'Language' })
  @IsEnum(Language)
  language: Language;

  @ApiProperty({ example: 'School maintenance' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Repairs to the Rawda school roof and classrooms.' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description: string;
}

// Q1. Deadlines, committees, suppliers, and scoring are not accepted: the
// whitelist answers them with FIELD_NOT_EDITABLE (ENGINEERING_STANDARDS.md §2.7).
export class CreateDraftTenderDto {
  @ApiProperty({ example: 'construction' })
  @IsString()
  @IsNotEmpty()
  categoryCode: string;

  @ApiProperty({ type: MoneyDto })
  @ValidateNested()
  @Type(() => MoneyDto)
  estimatedBalance: MoneyDto;

  @ApiProperty({ type: [TenderTranslationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => TenderTranslationDto)
  translations: TenderTranslationDto[];
}

// Q4. Sends the revision it was based on; the other fields replace what is
// stored. `translations` replaces the whole set.
export class UpdateDraftTenderDto {
  @ApiProperty({ example: 2 })
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
}
