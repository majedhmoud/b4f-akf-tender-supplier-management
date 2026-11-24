import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { Language } from '../../generated/prisma/client.js';

export class MobileRefreshDto {
  @ApiProperty()
  @IsString()
  @Length(1, 256)
  refreshToken: string;
}

export class MobileSessionUser {
  @ApiProperty() id: string;
  @ApiProperty({ enum: Language, enumName: 'Language' }) preferredLanguage: Language;
}

export class MobileSessionView {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
  @ApiProperty({ example: 600 }) expiresIn: number;
  @ApiProperty({ type: MobileSessionUser }) user: MobileSessionUser;
}
