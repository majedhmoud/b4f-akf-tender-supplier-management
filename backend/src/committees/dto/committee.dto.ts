import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PageMeta, PageQueryDto } from '../../common/pagination/pagination.js';
import { AssignmentStatus, CommitteeType, Language } from '../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// C2 (API_CONTRACT.md, Committees).
export class RaiseCommitteeDto {
  @ApiProperty({ enum: CommitteeType, enumName: 'CommitteeType' })
  @IsEnum(CommitteeType)
  type: CommitteeType;
}

export class CommitteeRaised {
  @ApiProperty({ enum: CommitteeType, enumName: 'CommitteeType' }) type: CommitteeType;
  @ApiProperty({ example: '2026-11-24T09:00:00Z' }) raisedAt: string;
}

// C3.
export class NominateDto {
  @ApiProperty({ example: 'Omar F.', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nomineeName: string;

  @ApiProperty({ example: 'omar@akf.org', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  nomineeEmail: string;
}

export class NominationCreated {
  @ApiProperty() id: string;
  @ApiProperty({ enum: AssignmentStatus, enumName: 'AssignmentStatus' }) status: AssignmentStatus;
  @ApiProperty() hasAccount: boolean;
}

export class NominationItem {
  @ApiProperty() id: string;
  @ApiProperty() nomineeName: string;
  @ApiProperty({ enum: AssignmentStatus, enumName: 'AssignmentStatus' }) status: AssignmentStatus;
}

export class CommitteeView {
  @ApiProperty({ enum: CommitteeType, enumName: 'CommitteeType' }) type: CommitteeType;
  @ApiProperty() raisedAt: string;
  @ApiProperty({ type: [NominationItem] }) nominations: NominationItem[];
}

export class CommitteePage {
  @ApiProperty({ type: [CommitteeView] }) data: CommitteeView[];
  @ApiProperty({ type: PageMeta }) meta: PageMeta;
}

export class TenderContentTitle {
  @ApiProperty({ enum: Language, enumName: 'Language' }) language: Language;
  @ApiProperty() title: string;
}

// C5.
export class NominationQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ['nominated'], default: 'nominated' })
  @IsOptional()
  @IsIn(['nominated'])
  status = 'nominated';
}

export class AdminNominationItem {
  @ApiProperty() id: string;
  @ApiProperty() tenderId: string;
  @ApiProperty({ type: TenderContentTitle }) tenderContent: TenderContentTitle;
  @ApiProperty({ enum: CommitteeType, enumName: 'CommitteeType' }) committeeType: CommitteeType;
  @ApiProperty() nomineeName: string;
  @ApiProperty() nomineeEmail: string;
  @ApiProperty() hasAccount: boolean;
}

export class AdminNominationPage {
  @ApiProperty({ type: [AdminNominationItem] }) data: AdminNominationItem[];
  @ApiProperty({ type: PageMeta }) meta: PageMeta;
}

// C6: the language is required only when approval creates the account.
export class ApproveNominationDto {
  @ApiPropertyOptional({ enum: Language, enumName: 'Language' })
  @IsOptional()
  @IsEnum(Language)
  preferredLanguage?: Language;
}

export class SetupEmailState {
  @ApiProperty({ enum: Language, enumName: 'Language' }) language: Language;
  @ApiProperty({ enum: ['sending'] }) status: 'sending';
}

export class NominationDecision {
  @ApiProperty({ enum: ['approved', 'rejected'] }) status: 'approved' | 'rejected';
  @ApiPropertyOptional() accountCreated?: boolean;
  @ApiPropertyOptional({ type: SetupEmailState }) setupEmail?: SetupEmailState;
}

// C7.
export const ASSIGNMENT_STAGES = ['waiting', 'open', 'read_only'] as const;

export class AssignmentItem {
  @ApiProperty() assignmentId: string;
  @ApiProperty() tenderId: string;
  @ApiProperty({ type: TenderContentTitle }) tenderContent: TenderContentTitle;
  @ApiProperty({ enum: CommitteeType, enumName: 'CommitteeType' }) committeeType: CommitteeType;
  @ApiProperty({ enum: ASSIGNMENT_STAGES, enumName: 'AssignmentStage' })
  stage: (typeof ASSIGNMENT_STAGES)[number];
  @ApiProperty() pendingCount: number;
}

export class AssignmentPage {
  @ApiProperty({ type: [AssignmentItem] }) data: AssignmentItem[];
  @ApiProperty({ type: PageMeta }) meta: PageMeta;
}
