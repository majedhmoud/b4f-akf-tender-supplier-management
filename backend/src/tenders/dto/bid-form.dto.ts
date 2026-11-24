import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { FormInputType, Language, PartType } from '../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class FieldTranslationDto {
  @ApiProperty({ enum: Language, enumName: 'Language' })
  @IsEnum(Language)
  language: Language;

  @ApiProperty({ example: 'Memory per laptop' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label: string;

  @ApiPropertyOptional({ example: 'Enter the installed RAM.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  instructions?: string;
}

// One custom field. Omit fieldId for a new field; keep the server-issued id
// for an existing one (API_CONTRACT.md, Supplier form editor).
export class CustomFieldDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fieldId?: string;

  @ApiProperty({ enum: FormInputType, enumName: 'FormInputType' })
  @IsEnum(FormInputType)
  type: FormInputType;

  @ApiProperty()
  @IsBoolean()
  required: boolean;

  @ApiPropertyOptional({ example: 'GB', description: 'Number fields only' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ example: 16, description: 'Number fields only' })
  @IsOptional()
  @IsNumber()
  minimum?: number;

  @ApiProperty({ type: [FieldTranslationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => FieldTranslationDto)
  translations: FieldTranslationDto[];
}

export class BidFormPartInputDto {
  @ApiProperty({ enum: PartType, enumName: 'PartType' })
  @IsEnum(PartType)
  partType: PartType;

  @ApiProperty({ type: [CustomFieldDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CustomFieldDto)
  customFields: CustomFieldDto[];
}

// M11: the whole template, all three parts.
export class SaveBidFormDto {
  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  revision: number;

  @ApiProperty({ type: [BidFormPartInputDto] })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => BidFormPartInputDto)
  parts: BidFormPartInputDto[];
}

export class StandardFieldView {
  @ApiProperty({ example: 'authorizedSignatoryName' }) name: string;
  @ApiProperty({ example: 'text' }) type: string;
  @ApiProperty() required: boolean;
  @ApiProperty({ example: 120 }) maxLength: number;
}

export class StandardDocumentView {
  @ApiProperty({ example: 'registration_certificate' }) kind: string;
  @ApiProperty() required: boolean;
}

export class CustomFieldView {
  @ApiProperty() fieldId: string;
  @ApiProperty({ enum: FormInputType, enumName: 'FormInputType' }) type: FormInputType;
  @ApiProperty() required: boolean;
  @ApiProperty({ nullable: true, type: String }) unit: string | null;
  @ApiProperty({ nullable: true, type: Number }) minimum: number | null;
  @ApiProperty({ type: [FieldTranslationDto] }) translations: FieldTranslationDto[];
}

export class BidFormPartView {
  @ApiProperty({ enum: PartType, enumName: 'PartType' }) partType: PartType;
  @ApiProperty({ type: [StandardFieldView] }) fields: StandardFieldView[];
  @ApiProperty({ type: [StandardDocumentView] }) documents: StandardDocumentView[];
  @ApiProperty({ type: [CustomFieldView] }) customFields: CustomFieldView[];
}

// M10: definitions only, never answers.
export class BidFormEditorView {
  @ApiProperty() revision: number;
  @ApiProperty({ example: ['save'], type: [String] }) allowedActions: string[];
  @ApiProperty({ type: [BidFormPartView] }) parts: BidFormPartView[];
}
