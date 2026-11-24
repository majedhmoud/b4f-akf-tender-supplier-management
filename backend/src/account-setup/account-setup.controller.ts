import { Body, Controller, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { AccountSetupService } from './account-setup.service.js';
import {
  CompleteSetupDto,
  CompletedSetupView,
  SetupLinkView,
  SetupTokenDto,
} from './dto/account-setup.dto.js';

// S1–S3 in API_CONTRACT.md §2. Public: the token is the proof. Every POST
// still needs X-CSRF-Token (§1.1). 20 calls a minute per IP guards against
// token guessing; tests raise it with ACCOUNT_SETUP_RATE_LIMIT.
@ApiTags('Account setup')
@Public()
@Throttle({
  default: { limit: () => Number(process.env.ACCOUNT_SETUP_RATE_LIMIT ?? 20), ttl: 60_000 },
})
@UseGuards(ThrottlerGuard)
@ApiNotFoundResponse({ description: 'The link is invalid' })
@ApiGoneResponse({ description: 'SETUP_LINK_EXPIRED or SETUP_LINK_USED' })
@ApiTooManyRequestsResponse({ description: 'RATE_LIMITED, with Retry-After' })
@Controller('account-setup')
export class AccountSetupController {
  constructor(private readonly setup: AccountSetupService) {}

  // S1: checks the link and leaves it usable.
  @Post('verify')
  @HttpCode(200)
  @ApiOkResponse({ type: SetupLinkView })
  verify(@Body() dto: SetupTokenDto): Promise<SetupLinkView> {
    return this.setup.verify(dto.token);
  }

  // S2: sets the password, uses the link up, and signs the holder in.
  @Post('complete')
  @HttpCode(200)
  @ApiOkResponse({ type: CompletedSetupView, description: 'Or 400 PASSWORD_TOO_WEAK' })
  complete(
    @Body() dto: CompleteSetupDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CompletedSetupView> {
    return this.setup.complete(dto.token, dto.password, res);
  }

  // S3: always 202. Emails a new link only for an expired, unused one.
  @Post('resend')
  @HttpCode(202)
  @ApiAcceptedResponse({ description: 'Accepted, whether or not a link was sent' })
  resend(@Body() dto: SetupTokenDto): Promise<void> {
    return this.setup.resend(dto.token);
  }
}
