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
import { Language, SignupDecision } from '../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export class SupplierApplicationDto {
  @ApiProperty({ example: 'Al-Noor Engineering', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName: string;
  @ApiProperty({ example: 'CR-88231', maxLength: 100 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  registrationNumber: string;
  // Lower-cased like sign-in emails, so the account created later matches it.
  @ApiProperty({ example: 'info@alnoor.example', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  contactEmail: string;
  @ApiProperty({ enum: Language, enumName: 'Language' })
  @IsEnum(Language)
  preferredLanguage: Language;
}
export class SignupReviewDto {
  @ApiProperty({ enum: SignupDecision, enumName: 'SignupDecision' })
  @IsEnum(SignupDecision)
  decision: SignupDecision;
  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 2000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  reason?: string | null;
}
export class PendingSignupQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ['pending'], default: 'pending' })
  @IsOptional()
  @IsIn(['pending'])
  status = 'pending';
}
export class RaisedSignupQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ['raised'], default: 'raised' })
  @IsOptional()
  @IsIn(['raised'])
  status = 'raised';
}
export class SubmittedApplication {
  @ApiProperty() applicationId: string;
  @ApiProperty({ format: 'date-time' }) submittedAt: string;
}
export class ApplicationSummary extends SubmittedApplication {
  @ApiProperty() legalName: string;
  @ApiProperty() registrationNumber: string;
}
export class ApplicationPage {
  @ApiProperty({ type: [ApplicationSummary] }) data: ApplicationSummary[];
  @ApiProperty({ type: PageMeta }) meta: PageMeta;
}
export class ApplicationFieldsView extends ApplicationSummary {
  @ApiProperty() contactEmail: string;
  @ApiProperty({ enum: Language, enumName: 'Language' }) preferredLanguage: Language;
}
export class ApplicationDocumentView {
  @ApiProperty() id: string;
  @ApiProperty() kind: string;
  @ApiProperty() name: string;
  @ApiProperty() language: string;
}
export class LegalApplicationView extends ApplicationFieldsView {
  @ApiProperty({ type: [ApplicationDocumentView] }) documents: ApplicationDocumentView[];
}
export class SignupReviewResult {
  @ApiProperty({ enum: SignupDecision, enumName: 'SignupDecision' }) decision: SignupDecision;
  @ApiProperty({ nullable: true, format: 'date-time', type: String }) raisedToAdminAt:
    string | null;
}
export class AcceptedSignupReviewView extends SignupReviewResult {
  @ApiProperty() reviewerUserId: string;
  @ApiProperty({ nullable: true, type: String }) reason: string | null;
  @ApiProperty({ format: 'date-time' }) decidedAt: string;
}
export class AdminSignupRequestView extends ApplicationFieldsView {
  @ApiProperty({ type: AcceptedSignupReviewView }) review: AcceptedSignupReviewView;
}
// R2's metadata matches the accepted contract, not the tender form builder.
export class SignupFieldSpec {
  @ApiProperty() name: string;
  @ApiProperty() type: string;
  @ApiProperty() required: boolean;
  @ApiPropertyOptional() maxLength?: number;
  @ApiPropertyOptional({ type: [String] }) values?: string[];
}
export class SignupDocumentSpec {
  @ApiProperty() kind: string;
  @ApiProperty() required: boolean;
}
export class SupplierApplicationForm {
  @ApiProperty({ type: [SignupFieldSpec] }) fields: SignupFieldSpec[];
  @ApiProperty({ type: [SignupDocumentSpec] }) documents: SignupDocumentSpec[];
}
export class SetupEmailStatus {
  @ApiProperty({ enum: Language, enumName: 'Language' })
  language: Language;
  @ApiProperty({ enum: ['sending'] })
  status: 'sending';
}
// U7 (API_CONTRACT.md, Sign-up and account setup).
export class SignupAcceptResult {
  @ApiProperty({ example: 's-12' })
  supplierId: string;
  @ApiProperty({ enum: ['pending_setup'] })
  accountStatus: 'pending_setup';
  @ApiProperty({ type: SetupEmailStatus })
  setupEmail: SetupEmailStatus;
}
