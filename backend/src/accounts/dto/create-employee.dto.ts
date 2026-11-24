import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsString, Length, MaxLength } from 'class-validator';
import { Language } from '../../generated/prisma/client.js';

function trim({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateEmployeeDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  displayName: string;

  @ApiProperty({ format: 'email', maxLength: 254 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ enum: Language, enumName: 'Language' })
  @IsEnum(Language)
  preferredLanguage: Language;
}

export class CreatedEmployee {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty({ enum: ['pending_setup'] })
  status: 'pending_setup';
}
