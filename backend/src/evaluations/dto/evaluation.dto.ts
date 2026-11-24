import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PageMeta } from '../../common/pagination/pagination.js';
import { LegalOutcome } from '../../generated/prisma/client.js';

// Separate DTOs per committee; absent fields are never sent (API_CONTRACT.md,
// Evaluation).

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class LegalEvaluationDto {
  @ApiProperty({ enum: LegalOutcome, enumName: 'LegalOutcome' })
  @IsEnum(LegalOutcome)
  outcome: LegalOutcome;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000, description: 'Required for fail' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  reason?: string | null;
}

export class TechnicalEvaluationDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  technicalScore: number;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  comments?: string;
}

export class FinancialEvaluationDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  financialScore: number;

  @ApiProperty({ example: '118500.00', description: 'Decimal string in the tender currency' })
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/)
  confirmedTotalPrice: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  comments?: string;
}

export class EvaluationDocument {
  @ApiProperty() id: string;
  @ApiProperty({ type: String, nullable: true }) kind: string | null;
  @ApiProperty({ description: 'Original name for legal; a neutral name otherwise' }) name: string;
  @ApiProperty() language: string;
  @ApiProperty({ type: [Object], example: [] }) translations: never[];
}

export class EvaluationAnswer {
  @ApiProperty() fieldId: string;
  @ApiProperty() label: string;
  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] })
  value: string | number | boolean | null;
}

export class SupplierIdentity {
  @ApiProperty() id: string;
  @ApiProperty() legalName: string;
  @ApiProperty() registrationNumber: string;
}

export class LegalEvaluationView {
  @ApiProperty({ enum: LegalOutcome, enumName: 'LegalOutcome' }) outcome: LegalOutcome;
  @ApiProperty({ type: String, nullable: true }) reason: string | null;
  @ApiProperty() submittedAt: string;
}

export class TechnicalEvaluationView {
  @ApiProperty() technicalScore: number;
  @ApiProperty({ type: String, nullable: true }) comments: string | null;
  @ApiProperty() submittedAt: string;
}

export class FinancialEvaluationView {
  @ApiProperty() financialScore: number;
  @ApiProperty() confirmedTotalPrice: string;
  @ApiProperty({ type: String, nullable: true }) comments: string | null;
  @ApiProperty() submittedAt: string;
}

export const EVALUATION_ACTIONS = ['submit'] as const;

export class LegalBidView {
  @ApiProperty() bidId: string;
  @ApiProperty({ type: SupplierIdentity }) supplier: SupplierIdentity;
  @ApiProperty({ type: Object, example: { authorizedSignatoryName: 'Hiba Saleh' } })
  legalInformation: Record<string, string>;
  @ApiProperty({ type: [EvaluationDocument] }) documents: EvaluationDocument[];
  @ApiProperty({ type: [EvaluationAnswer] }) answers: EvaluationAnswer[];
  @ApiProperty({ type: LegalEvaluationView, nullable: true })
  evaluation: LegalEvaluationView | null;
  @ApiProperty({ enum: EVALUATION_ACTIONS, isArray: true }) allowedActions: 'submit'[];
}

export class TechnicalBidView {
  @ApiProperty() bidderCode: string;
  @ApiProperty({ type: [EvaluationDocument] }) documents: EvaluationDocument[];
  @ApiProperty({ type: [EvaluationAnswer] }) answers: EvaluationAnswer[];
  @ApiProperty({ type: TechnicalEvaluationView, nullable: true })
  evaluation: TechnicalEvaluationView | null;
  @ApiProperty({ enum: EVALUATION_ACTIONS, isArray: true }) allowedActions: 'submit'[];
}

export class FinancialBidView {
  @ApiProperty() bidderCode: string;
  @ApiProperty({ example: 'USD' }) tenderCurrency: string;
  @ApiProperty({ type: [EvaluationDocument] }) documents: EvaluationDocument[];
  @ApiProperty({ type: [EvaluationAnswer] }) answers: EvaluationAnswer[];
  @ApiProperty({ type: FinancialEvaluationView, nullable: true })
  evaluation: FinancialEvaluationView | null;
  @ApiProperty({ enum: EVALUATION_ACTIONS, isArray: true }) allowedActions: 'submit'[];
}

export class LegalQueueItem {
  @ApiProperty() bidId: string;
  @ApiProperty({ type: Object, example: { legalName: 'Al-Noor Engineering' } })
  supplier: { legalName: string };
  @ApiProperty() evaluated: boolean;
}

export class BlindQueueItem {
  @ApiProperty() bidderCode: string;
  @ApiProperty() evaluated: boolean;
}

export class LegalQueuePage {
  @ApiProperty({ type: [LegalQueueItem] }) data: LegalQueueItem[];
  @ApiProperty({ type: PageMeta }) meta: PageMeta;
}

export class BlindQueuePage {
  @ApiProperty({ type: [BlindQueueItem] }) data: BlindQueueItem[];
  @ApiProperty({ type: PageMeta }) meta: PageMeta;
}
