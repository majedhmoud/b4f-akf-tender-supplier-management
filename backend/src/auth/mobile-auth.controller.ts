import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import { MobileRefreshDto, MobileSessionView } from './dto/mobile-session.dto.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { MobileAuthBody } from './mobile-auth.metadata.js';

@ApiTags('Mobile Auth (S7)')
@Controller('mobile/auth')
export class MobileAuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @MobileAuthBody()
  @UseGuards(ThrottlerGuard)
  @Post('sign-in')
  @HttpCode(200)
  @ApiOkResponse({ type: MobileSessionView })
  @ApiTooManyRequestsResponse({ description: 'RATE_LIMITED, with Retry-After' })
  signIn(@Body() dto: SignInDto): Promise<MobileSessionView> {
    return this.auth.signInMobile(dto.email, dto.password);
  }

  @Public()
  @MobileAuthBody()
  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: MobileSessionView })
  refresh(@Body() dto: MobileRefreshDto): Promise<MobileSessionView> {
    return this.auth.refreshMobile(dto.refreshToken);
  }

  @Public()
  @MobileAuthBody()
  @Post('sign-out')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Mobile session ended' })
  signOut(@Body() dto: MobileRefreshDto): Promise<void> {
    return this.auth.signOutMobile(dto.refreshToken);
  }
}
