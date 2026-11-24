import { ApiProperty } from '@nestjs/swagger';
import { CancellationReason, Language, TenderStatus } from '../../generated/prisma/client.js';
import { PageMeta } from '../../common/pagination/pagination.js';
import { MoneyDto, TenderTranslationDto } from './tender-input.dto.js';

export class TenderDeadlines {
  @ApiProperty({ example: '2026-12-10T12:00:00Z' }) application: string;
  @ApiProperty({ example: '2026-12-17T12:00:00Z' }) technical: string;
  @ApiProperty({ example: '2026-12-24T12:00:00Z' }) financial: string;
}

export class TenderDocumentTranslationView {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'ToR (en).pdf' }) name: string;
  @ApiProperty({ example: 'en' }) language: string;
}

export class TenderDocumentView {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'terms_of_reference' }) kind: string;
  @ApiProperty({ example: 'ToR.pdf' }) name: string;
  @ApiProperty({ example: 'ar' }) language: string;
  @ApiProperty({ type: [TenderDocumentTranslationView] })
  translations: TenderDocumentTranslationView[];
}

// Q3: what the requesting employee sees. Never: scoring settings, committees,
// ranking, award details, bids (API_CONTRACT.md, Employee Tenders).
export class EmployeeTender {
  @ApiProperty() id: string;
  @ApiProperty({ enum: TenderStatus, enumName: 'TenderStatus' }) status: TenderStatus;
  @ApiProperty() revision: number;
  @ApiProperty({ example: 'construction' }) categoryCode: string;
  @ApiProperty({ type: MoneyDto }) estimatedBalance: MoneyDto;
  @ApiProperty({ type: [TenderTranslationDto] }) translations: TenderTranslationDto[];
  @ApiProperty({ type: TenderDeadlines, nullable: true }) deadlines: TenderDeadlines | null;
  @ApiProperty({ type: [TenderDocumentView] }) documents: TenderDocumentView[];
  @ApiProperty({ enum: CancellationReason, enumName: 'CancellationReason', nullable: true })
  cancellationReason: CancellationReason | null;
  @ApiProperty({ example: ['edit'], isArray: true, type: String }) allowedActions: string[];
}

export class TenderContentSummary {
  @ApiProperty({ enum: Language, enumName: 'Language' }) language: Language;
  @ApiProperty() title: string;
}

// Q2 list item: enough for the "My tenders" table.
export class EmployeeTenderSummary {
  @ApiProperty() id: string;
  @ApiProperty({ enum: TenderStatus, enumName: 'TenderStatus' }) status: TenderStatus;
  @ApiProperty({ example: 'construction' }) categoryCode: string;
  @ApiProperty({ type: TenderContentSummary }) content: TenderContentSummary;
  @ApiProperty({ enum: Language, enumName: 'Language' }) requestedLanguage: Language;
  @ApiProperty() isFallback: boolean;
  @ApiProperty({ example: '2026-11-23T08:30:00Z' }) createdAt: string;
}

export class EmployeeTenderPage {
  @ApiProperty({ type: [EmployeeTenderSummary] }) data: EmployeeTenderSummary[];
  @ApiProperty({ type: PageMeta }) meta: PageMeta;
}

export class CreatedTender {
  @ApiProperty() id: string;
  @ApiProperty({ enum: TenderStatus, enumName: 'TenderStatus', example: 'draft' })
  status: TenderStatus;
  @ApiProperty({ example: 1 }) revision: number;
}

export class TenderRevision {
  @ApiProperty({ example: 3 }) revision: number;
}
