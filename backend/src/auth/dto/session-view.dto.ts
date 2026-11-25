import { ApiProperty } from '@nestjs/swagger';
import { Language, Role } from '../../generated/prisma/client.js';

// The signed-in user as the web app sees it
// (API_CONTRACT.md, Auth). Account roles only; tender assignments come from
// GET /me/assignments.
export class SessionUser {
  @ApiProperty({ example: 'b7c1…' })
  id: string;

  @ApiProperty({ example: 'rana@akf.org' })
  email: string;

  @ApiProperty({ example: 'Rana Saleh' })
  displayName: string;

  @ApiProperty({ enum: Language, enumName: 'Language' })
  preferredLanguage: Language;

  @ApiProperty({ enum: Role, enumName: 'Role', isArray: true })
  roles: Role[];
}

export class SessionView {
  @ApiProperty({ type: SessionUser })
  user: SessionUser;

  // Always null until supplier accounts arrive with S2.
  @ApiProperty({ type: Object, nullable: true, example: null })
  supplier: null;

  @ApiProperty({ example: '2026-11-23T09:00:00Z' })
  serverTime: string;
}

export class CsrfTokenView {
  @ApiProperty()
  csrfToken: string;

  @ApiProperty({ example: '2026-11-23T09:00:00Z' })
  serverTime: string;
}
