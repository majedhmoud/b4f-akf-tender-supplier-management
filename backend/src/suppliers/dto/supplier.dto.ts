import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageMeta, PageQueryDto } from '../../common/pagination/pagination.js';
import { SupplierDocumentKind, SupplierStatus } from '../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const EDITABLE_FIELDS = ['legalName', 'registrationNumber', 'technicalInformation'] as const;

// P2 (API_CONTRACT.md, Suppliers). Any other field is FIELD_NOT_EDITABLE.
export class SupplierProfileUpdateDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  registrationNumber?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  technicalInformation?: string;
}

export const CERTIFICATE_KINDS = Object.values(SupplierDocumentKind);

// One certificate as the supplier sees it: the reviewed sign-up file until
// the supplier replaces it (ERD, Sign-up).
export class SupplierCertificate {
  @ApiProperty() id: string;
  @ApiProperty({ enum: SupplierDocumentKind, enumName: 'SupplierDocumentKind' })
  kind: SupplierDocumentKind;
  @ApiProperty() name: string;
  @ApiProperty({ example: 'ar' }) language: string;
  @ApiProperty({ example: '2026-11-23T09:10:00Z' }) uploadedAt: string;
  @ApiProperty({ enum: ['sign_up', 'updated'], enumName: 'CertificateSource' })
  source: 'sign_up' | 'updated';
}

export class SupplierProfile {
  @ApiProperty() id: string;
  @ApiProperty() legalName: string;
  @ApiProperty() registrationNumber: string;
  @ApiProperty({ enum: SupplierStatus, enumName: 'SupplierStatus' }) status: SupplierStatus;
  @ApiProperty() technicalInformation: string;
  @ApiProperty({ type: [SupplierCertificate] }) certificates: SupplierCertificate[];
  // Technical documents arrive with P3; always empty until then.
  @ApiProperty({ type: [Object], example: [] }) technicalDocuments: never[];
  @ApiProperty({ enum: EDITABLE_FIELDS, isArray: true })
  editableFields: (typeof EDITABLE_FIELDS)[number][];
}

export const SUPPLIER_ACTIONS = ['suspend', 'reactivate'] as const;

export class SupplierQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: SupplierStatus, enumName: 'SupplierStatus' })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  @ApiPropertyOptional({ maxLength: 100, description: 'Legal name or registration number' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class SupplierListItem {
  @ApiProperty() id: string;
  @ApiProperty() legalName: string;
  @ApiProperty() registrationNumber: string;
  @ApiProperty({ enum: SupplierStatus, enumName: 'SupplierStatus' }) status: SupplierStatus;
  @ApiProperty({ enum: SUPPLIER_ACTIONS, enumName: 'SupplierAction', isArray: true })
  allowedActions: (typeof SUPPLIER_ACTIONS)[number][];
}

export class SupplierPage {
  @ApiProperty({ type: [SupplierListItem] }) data: SupplierListItem[];
  @ApiProperty({ type: PageMeta }) meta: PageMeta;
}

export class SupplierStatusResult {
  @ApiProperty({ enum: SupplierStatus, enumName: 'SupplierStatus' }) status: SupplierStatus;
}
