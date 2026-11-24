import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Language, TenderStatus } from '../../generated/prisma/client.js';
import { PageMeta, PageQueryDto } from '../../common/pagination/pagination.js';
import { TenderDeadlines, TenderDocumentView } from './employee-tender.dto.js';

export class PublicTenderQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: 'construction' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}

export class PublicContentSummary {
  @ApiProperty({ enum: Language, enumName: 'Language' }) language: Language;
  @ApiProperty() title: string;
}

export class PublicContent extends PublicContentSummary {
  @ApiProperty() description: string;
}

// T1 list item (API_CONTRACT.md, Public Tenders).
export class PublicTenderSummary {
  @ApiProperty() id: string;
  @ApiProperty({ enum: TenderStatus, enumName: 'TenderStatus', example: 'published' })
  status: TenderStatus;
  @ApiProperty({ example: 'construction' }) categoryCode: string;
  @ApiProperty({ type: PublicContentSummary }) content: PublicContentSummary;
  @ApiProperty({ enum: Language, enumName: 'Language' }) requestedLanguage: Language;
  @ApiProperty() isFallback: boolean;
  @ApiProperty({ example: '2026-12-10T12:00:00Z' }) applicationDeadline: string;
}

export class PublicTenderPage {
  @ApiProperty({ type: [PublicTenderSummary] }) data: PublicTenderSummary[];
  @ApiProperty({ type: PageMeta }) meta: PageMeta;
}

// T2: a published tender for anyone. Never: estimated balance, scoring
// settings, committees, the requesting employee, bid counts
// (API_CONTRACT.md, Public Tenders; ENGINEERING_STANDARDS.md §2.7).
export class PublicTender {
  @ApiProperty() id: string;
  @ApiProperty({ enum: TenderStatus, enumName: 'TenderStatus', example: 'published' })
  status: TenderStatus;
  @ApiProperty({ example: 'construction' }) categoryCode: string;
  @ApiProperty({ type: PublicContent }) content: PublicContent;
  @ApiProperty({ enum: Language, enumName: 'Language' }) requestedLanguage: Language;
  @ApiProperty() isFallback: boolean;
  @ApiProperty({ enum: Language, enumName: 'Language', isArray: true })
  availableLanguages: Language[];
  @ApiProperty({ type: TenderDeadlines }) deadlines: TenderDeadlines;
  @ApiProperty({ type: [TenderDocumentView] }) documents: TenderDocumentView[];
  @ApiProperty({ example: '2026-11-23T09:00:00Z' }) serverTime: string;
}
