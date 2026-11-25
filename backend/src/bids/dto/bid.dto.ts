import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageMeta } from '../../common/pagination/pagination.js';
import { FormInputType, Language, PartType, TenderStatus } from '../../generated/prisma/client.js';

// Shapes from API_CONTRACT.md, Bids (B1–B4, B6).

export class StandardFieldSpec {
  @ApiProperty() name: string;
  @ApiProperty({ enum: ['text'] }) type: 'text';
  @ApiProperty() required: boolean;
  @ApiProperty() maxLength: number;
}

export class StandardDocumentSpec {
  @ApiProperty() kind: string;
  @ApiProperty() required: boolean;
}

export class CustomFieldSpec {
  @ApiProperty() fieldId: string;
  @ApiProperty({ enum: FormInputType, enumName: 'FormInputType' }) type: FormInputType;
  @ApiProperty() required: boolean;
  @ApiProperty({ type: String, nullable: true }) unit: string | null;
  @ApiProperty({ type: Number, nullable: true }) minimum: number | null;
  @ApiProperty() label: string;
  @ApiProperty({ type: String, nullable: true }) instructions: string | null;
  @ApiProperty({ enum: Language, enumName: 'Language' }) language: Language;
}

export class BidFormPart {
  @ApiProperty({ enum: PartType, enumName: 'PartType' }) partType: PartType;
  @ApiProperty({ type: [StandardFieldSpec] }) fields: StandardFieldSpec[];
  @ApiProperty({ type: [StandardDocumentSpec] }) documents: StandardDocumentSpec[];
  @ApiProperty({ type: [CustomFieldSpec] }) customFields: CustomFieldSpec[];
}

export class BidDeadlines {
  @ApiProperty() application: string;
  @ApiProperty() technical: string;
  @ApiProperty() financial: string;
}

export const BID_REASONS = ['SUPPLIER_SUSPENDED', 'APPLICATION_CLOSED', 'BID_EXISTS'] as const;
export const PART_ACTIONS = ['replace'] as const;

export class ExistingBid {
  @ApiProperty() bidId: string;
  @ApiProperty({ type: [String], example: ['replace_technical_offer'] })
  allowedActions: string[];
}

export class BidForm {
  @ApiProperty() canSubmit: boolean;
  @ApiProperty({ enum: BID_REASONS, enumName: 'BidReasonCode', nullable: true })
  reasonCode: (typeof BID_REASONS)[number] | null;
  @ApiProperty({ type: ExistingBid, nullable: true }) existingBid: ExistingBid | null;
  @ApiProperty({ type: BidDeadlines }) deadlines: BidDeadlines;
  @ApiProperty({ type: [BidFormPart] }) parts: BidFormPart[];
  @ApiProperty() serverTime: string;
}

export class TenderTitle {
  @ApiProperty({ enum: Language, enumName: 'Language' }) language: Language;
  @ApiProperty() title: string;
}

export class BidTenderRef {
  @ApiProperty() id: string;
  @ApiProperty({ enum: TenderStatus, enumName: 'TenderStatus' }) status: TenderStatus;
  @ApiProperty({ type: TenderTitle }) content: TenderTitle;
}

export class BidDocumentView {
  @ApiProperty() id: string;
  @ApiProperty({ type: String, nullable: true, description: 'Null for a custom file field' })
  kind: string | null;
  @ApiPropertyOptional({ description: 'Set for a custom file field' }) fieldId?: string;
  @ApiProperty() name: string;
  @ApiProperty() language: string;
  // Translations are postponed after V1: always empty.
  @ApiProperty({ type: [Object], example: [] }) translations: never[];
}

export class BidPartView {
  @ApiProperty({ enum: PartType, enumName: 'PartType' }) partType: PartType;
  @ApiProperty() deadline: string;
  @ApiProperty() locked: boolean;
  @ApiProperty() lastSubmittedAt: string;
  @ApiProperty({ type: [BidDocumentView] }) documents: BidDocumentView[];
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Custom field answers keyed by field ID',
  })
  answers: Record<string, string | number | boolean | null>;
  @ApiProperty({ enum: PART_ACTIONS, enumName: 'BidPartAction', isArray: true })
  allowedActions: (typeof PART_ACTIONS)[number][];
}

export class LegalInformation {
  @ApiProperty() authorizedSignatoryName: string;
}

export class SupplierBid {
  @ApiProperty() id: string;
  @ApiProperty({ type: BidTenderRef }) tender: BidTenderRef;
  @ApiProperty({ type: LegalInformation }) legalInformation: LegalInformation;
  @ApiProperty({ type: [BidPartView] }) parts: BidPartView[];
  @ApiProperty() serverTime: string;
}

export class MobileBidPart {
  @ApiProperty({ enum: PartType, enumName: 'PartType' }) partType: PartType;
  @ApiProperty({ type: String, nullable: true }) deadline: string | null;
  @ApiProperty() locked: boolean;
}

export class MobileSupplierBid {
  @ApiProperty() id: string;
  @ApiProperty({ type: BidTenderRef }) tender: BidTenderRef;
  @ApiProperty({ type: [MobileBidPart] }) parts: MobileBidPart[];
  @ApiProperty() serverTime: string;
}

export class BidListItem {
  @ApiProperty() bidId: string;
  @ApiProperty({ type: BidTenderRef }) tender: BidTenderRef;
  @ApiProperty({ type: String, nullable: true }) nextDeadline: string | null;
  @ApiProperty({ enum: PartType, enumName: 'PartType', isArray: true }) lockedParts: PartType[];
}

export class BidPage {
  @ApiProperty({ type: [BidListItem] }) data: BidListItem[];
  @ApiProperty({ type: PageMeta }) meta: PageMeta;
}
