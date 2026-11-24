import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { PageMeta } from '../../common/pagination/pagination.js';
import { AwardSelection, CancellationReason, TenderStatus } from '../../generated/prisma/client.js';

// W1–W3 (API_CONTRACT.md, Award).

export const AWARD_STATUSES = [
  'in_progress',
  'tie_break_required',
  'awarded',
  'cancelled',
] as const;
export type AwardStatusValue = (typeof AWARD_STATUSES)[number];

export class StageProgress {
  @ApiProperty() done: number;
  @ApiProperty() total: number;
}

export class AwardProgress {
  @ApiProperty({ type: StageProgress }) legal: StageProgress;
  @ApiProperty({ type: StageProgress }) technical: StageProgress;
  @ApiProperty({ type: StageProgress }) financial: StageProgress;
}

export class SupplierName {
  @ApiProperty() id: string;
  @ApiProperty() legalName: string;
}

export class AwardView {
  @ApiProperty() bidId: string;
  @ApiProperty({ type: SupplierName }) supplier: SupplierName;
  @ApiProperty({ enum: AwardSelection, enumName: 'AwardSelection' }) selection: AwardSelection;
  @ApiProperty() awardedAt: string;
}

export class TieCandidate {
  @ApiProperty() bidId: string;
  @ApiProperty({ type: SupplierName }) supplier: SupplierName;
  @ApiProperty() technicalScore: number;
  @ApiProperty() financialScore: number;
  @ApiProperty({ example: '80.10' }) combinedScore: string;
}

export class AwardStatus {
  @ApiProperty() tenderId: string;
  @ApiProperty({ enum: TenderStatus, enumName: 'TenderStatus' }) tenderStatus: TenderStatus;
  @ApiProperty({ enum: AWARD_STATUSES, enumName: 'AwardStatusValue' })
  awardStatus: AwardStatusValue;
  @ApiProperty({ enum: CancellationReason, enumName: 'CancellationReason', nullable: true })
  cancellationReason: CancellationReason | null;
  @ApiProperty({ type: AwardProgress }) progress: AwardProgress;
  @ApiProperty({ type: AwardView, nullable: true }) award: AwardView | null;
  @ApiProperty({ type: [TieCandidate] }) tieBreakCandidates: TieCandidate[];
}

export class RankingRow {
  @ApiProperty() bidId: string;
  @ApiProperty() rank: number;
  @ApiProperty({ type: SupplierName }) supplier: SupplierName;
  @ApiProperty() technicalScore: number;
  @ApiProperty() financialScore: number;
  @ApiProperty({ example: '80.10' }) combinedScore: string;
  @ApiProperty() aboveEstimatedBalance: boolean;
}

export class RankingPage {
  @ApiProperty({ type: [RankingRow] }) data: RankingRow[];
  @ApiProperty({ type: PageMeta }) meta: PageMeta;
}

export class TieBreakDto {
  @ApiProperty() @IsUUID() bidId: string;
}

export class TieBreakAward {
  @ApiProperty() bidId: string;
  @ApiProperty({ enum: AwardSelection, enumName: 'AwardSelection' }) selection: AwardSelection;
  @ApiProperty() awardedAt: string;
}

export class TieBreakResult {
  @ApiProperty({ enum: TenderStatus, enumName: 'TenderStatus' }) tenderStatus: TenderStatus;
  @ApiProperty({ type: TieBreakAward }) award: TieBreakAward;
}
