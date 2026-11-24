import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import { CsrfService } from './csrf.service.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { CsrfTokenView, SessionView } from './dto/session-view.dto.js';

// A0–A4 in API_CONTRACT.md §2. Every POST needs X-CSRF-Token (§1.1).
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly csrf: CsrfService,
  ) {}

  @Public()
  @Get('csrf')
  @ApiOkResponse({ type: CsrfTokenView })
  getCsrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response): CsrfTokenView {
    return { csrfToken: this.csrf.issue(req, res), serverTime: new Date().toISOString() };
  }

  // Rate limited per IP (ENGINEERING_STANDARDS.md §2.4).
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('sign-in')
  @HttpCode(200)
  @ApiOkResponse({ type: SessionView })
  @ApiTooManyRequestsResponse({ description: 'RATE_LIMITED, with Retry-After' })
  signIn(@Body() dto: SignInDto, @Res({ passthrough: true }) res: Response): Promise<SessionView> {
    return this.authService.signIn(dto.email, dto.password, res);
  }

  @Get('session')
  @ApiCookieAuth()
  @ApiOkResponse({ type: SessionView })
  getSession(@CurrentUser() user: AuthenticatedUser): Promise<SessionView> {
    return this.authService.sessionView(user.id);
  }

  @Public()
  @Post('refresh')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'New session cookies set' })
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    return this.authService.refresh(req, res);
  }

  @Public()
  @Post('sign-out')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Session ended and cookies cleared' })
  signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    return this.authService.signOut(req, res);
  }
}
