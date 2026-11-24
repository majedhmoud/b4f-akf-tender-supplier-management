import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Language } from '../../generated/prisma/client.js';
import { SessionView } from '../../auth/dto/session-view.dto.js';

// The token from the link's fragment (API_CONTRACT.md, Sign-up and account setup).
export class SetupTokenDto {
  @ApiProperty({ description: 'The token from the setup link, after #token=' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token: string;
}

export class CompleteSetupDto extends SetupTokenDto {
  // At least 12 characters, checked after the link (ENGINEERING_STANDARDS.md §2.1).
  // bcrypt reads only the first 72 bytes, so longer passwords are refused.
  @ApiProperty({ minLength: 12, maxLength: 72 })
  @IsString()
  @MaxLength(72)
  password: string;
}

export const ACCOUNT_TYPES = ['supplier', 'committee_member'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export class SetupLinkView {
  @ApiProperty({ example: 'i***@alnoor.example' })
  email: string;

  @ApiProperty({ enum: Language, enumName: 'Language' })
  preferredLanguage: Language;

  @ApiProperty({ enum: ACCOUNT_TYPES, enumName: 'AccountType' })
  accountType: AccountType;
}

export const SETUP_NEXT = ['supplier_profile', 'my_assignments'] as const;

export class CompletedSetupView extends SessionView {
  @ApiProperty({ enum: SETUP_NEXT, enumName: 'SetupNext' })
  next: (typeof SETUP_NEXT)[number];
}
