import { ApiProperty } from '@nestjs/swagger';
import { CancellationReason, Language, TenderStatus } from '../../generated/prisma/client.js';
import { PageMeta } from '../../common/pagination/pagination.js';
import {
  TenderContentSummary,
  TenderDeadlines,
  TenderDocumentView,
} from './employee-tender.dto.js';
import { MoneyDto, TenderTranslationDto } from './tender-input.dto.js';
import { ScoringDto } from './manage-input.dto.js';

export class RequestedByView {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Lina H.' }) name: string;
}

// M2: the full tender for the procurement officer (API_CONTRACT.md,
// Tender Management). Never bid contents.
export class ManagedTender {
  @ApiProperty() id: string;
  @ApiProperty({ enum: TenderStatus, enumName: 'TenderStatus' }) status: TenderStatus;
  @ApiProperty() revision: number;
  @ApiProperty({ example: 'construction' }) categoryCode: string;
  @ApiProperty({ type: RequestedByView }) requestedBy: RequestedByView;
  @ApiProperty({ type: MoneyDto }) estimatedBalance: MoneyDto;
  @ApiProperty({ type: [TenderTranslationDto] }) translations: TenderTranslationDto[];
  @ApiProperty({ type: ScoringDto, nullable: true }) scoring: ScoringDto | null;
  @ApiProperty({ type: TenderDeadlines, nullable: true }) deadlines: TenderDeadlines | null;
  @ApiProperty({ type: [TenderDocumentView] }) documents: TenderDocumentView[];
  @ApiProperty({ nullable: true, type: String }) copiedFromTenderId: string | null;
  @ApiProperty({ nullable: true, type: String }) copiedIntoTenderId: string | null;
  @ApiProperty({ enum: CancellationReason, enumName: 'CancellationReason', nullable: true })
  cancellationReason: CancellationReason | null;
  @ApiProperty({ example: ['edit', 'upload_terms_of_reference', 'publish'], type: [String] })
  allowedActions: string[];
}

// M1 list item.
export class ManagedTenderSummary {
  @ApiProperty() id: string;
  @ApiProperty({ enum: TenderStatus, enumName: 'TenderStatus' }) status: TenderStatus;
  @ApiProperty({ example: 'construction' }) categoryCode: string;
  @ApiProperty({ type: TenderContentSummary }) content: TenderContentSummary;
  @ApiProperty({ enum: Language, enumName: 'Language' }) requestedLanguage: Language;
  @ApiProperty() isFallback: boolean;
  @ApiProperty({ type: RequestedByView }) requestedBy: RequestedByView;
  @ApiProperty({ type: TenderDeadlines, nullable: true }) deadlines: TenderDeadlines | null;
  @ApiProperty({ example: '2026-11-23T08:30:00Z' }) createdAt: string;
}

export class ManagedTenderPage {
  @ApiProperty({ type: [ManagedTenderSummary] }) data: ManagedTenderSummary[];
  @ApiProperty({ type: PageMeta }) meta: PageMeta;
}

export class AcceptedTender {
  @ApiProperty({ enum: TenderStatus, enumName: 'TenderStatus', example: 'accepted' })
  status: TenderStatus;
  @ApiProperty({ example: 4 }) revision: number;
}

export class PublishedTender {
  @ApiProperty({ enum: TenderStatus, enumName: 'TenderStatus', example: 'published' })
  status: TenderStatus;
  @ApiProperty({ example: 7 }) revision: number;
  @ApiProperty({ example: '2026-11-23T10:00:00Z' }) publishedAt: string;
}

export class CopiedTender {
  @ApiProperty() id: string;
  @ApiProperty({ enum: TenderStatus, enumName: 'TenderStatus', example: 'accepted' })
  status: TenderStatus;
  @ApiProperty({ example: 1 }) revision: number;
  @ApiProperty() copiedFromTenderId: string;
}

export class UploadedDocument {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'terms_of_reference' }) kind: string;
  @ApiProperty({ example: 'ToR.pdf' }) name: string;
  @ApiProperty({ example: 'ar' }) language: string;
  @ApiProperty({ nullable: true, type: String }) translationOf: string | null;
}

export class UploadedDocumentResult {
  @ApiProperty({ type: UploadedDocument }) document: UploadedDocument;
  @ApiProperty({ example: 5 }) revision: number;
}

export class DownloadLink {
  @ApiProperty({ example: '/api/v1/files/abc…?name=ToR.pdf&expires=…&signature=…' })
  url: string;
  @ApiProperty({ example: '2026-11-23T09:05:00Z' }) expiresAt: string;
}
