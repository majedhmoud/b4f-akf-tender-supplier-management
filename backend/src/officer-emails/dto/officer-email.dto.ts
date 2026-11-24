import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsObject, IsString, MaxLength, Min } from 'class-validator';
import { PageMeta, PageQueryDto } from '../../common/pagination/pagination.js';
import { EmailKind, EmailStatus, Language } from '../../generated/prisma/client.js';

// E1–E5 (API_CONTRACT.md, Emails).

export const LIST_KINDS = ['award', 'cancellation'] as const;

export class EmailListQueryDto extends PageQueryDto {
  @ApiProperty({ enum: LIST_KINDS })
  @IsIn(LIST_KINDS)
  kind: (typeof LIST_KINDS)[number];
}

export class EmailRecipient {
  @ApiProperty() supplierId: string;
  @ApiProperty() legalName: string;
  @ApiProperty({ example: 'i***@alnoor.example' }) email: string;
}

export class EmailFailure {
  @ApiProperty({ example: 'DELIVERY_FAILED' }) code: string;
  @ApiProperty() at: string;
}

export class OfficerEmail {
  @ApiProperty() id: string;
  @ApiProperty({ enum: EmailKind, enumName: 'EmailKind' }) kind: EmailKind;
  @ApiProperty({ enum: EmailStatus, enumName: 'EmailStatus' }) status: EmailStatus;
  @ApiProperty() revision: number;
  @ApiProperty({ enum: Language, enumName: 'Language' }) language: Language;
  @ApiProperty({ enum: ['ltr', 'rtl'] }) dir: 'ltr' | 'rtl';
  @ApiProperty({ type: EmailRecipient }) recipient: EmailRecipient;
  @ApiProperty() subject: string;
  @ApiProperty() body: string;
  @ApiProperty({ type: EmailFailure, nullable: true }) failure: EmailFailure | null;
  @ApiProperty({ type: String, nullable: true }) sentAt: string | null;
}

export class OfficerEmailPage {
  @ApiProperty({ type: [OfficerEmail] }) data: OfficerEmail[];
  @ApiProperty({ type: PageMeta }) meta: PageMeta;
}

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class EditEmailDto {
  @ApiProperty({ maxLength: 300 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  subject: string;

  @ApiProperty({ maxLength: 10000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body: string;

  @ApiProperty() @IsInt() @Min(1) revision: number;
}

export class RevisionResult {
  @ApiProperty() revision: number;
}

export class SendEmailDto {
  @ApiProperty() @IsInt() @Min(1) revision: number;
}

export class SendResult {
  @ApiProperty({ enum: EmailStatus, enumName: 'EmailStatus' }) status: EmailStatus;
  @ApiProperty() revision: number;
}

export class SendAllDto {
  @ApiProperty({ enum: LIST_KINDS })
  @IsIn(LIST_KINDS)
  kind: (typeof LIST_KINDS)[number];

  @ApiProperty({ type: 'object', additionalProperties: { type: 'integer' }, example: { 'm-1': 3 } })
  @IsObject()
  revisions: Record<string, number>;
}

export const SKIP_REASONS = [
  'revision_changed',
  'already_sending',
  'already_sent',
  'not_listed',
] as const;

export class SkippedEmail {
  @ApiProperty() id: string;
  @ApiProperty({ enum: SKIP_REASONS, enumName: 'SkipReason' })
  reason: (typeof SKIP_REASONS)[number];
}

export class SendAllResult {
  @ApiProperty({ type: [String] }) sending: string[];
  @ApiProperty({ type: [SkippedEmail] }) skipped: SkippedEmail[];
}
