import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Language } from '../../generated/prisma/client.js';

// A5: the only setting a user changes about themselves in V1.
export class UpdateMeDto {
  @ApiProperty({ enum: Language, enumName: 'Language', example: 'ar' })
  @IsEnum(Language)
  preferredLanguage: Language;
}
