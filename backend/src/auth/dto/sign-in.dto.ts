import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SignInDto {
  @ApiProperty({ example: 'employee@akf.demo' })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: '••••••••' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  password: string;
}
