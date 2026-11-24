import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { RequireRole } from '../auth/require-role.guard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import {
  EditEmailDto,
  EmailListQueryDto,
  OfficerEmail,
  OfficerEmailPage,
  RevisionResult,
  SendAllDto,
  SendAllResult,
  SendEmailDto,
  SendResult,
} from './dto/officer-email.dto.js';
import { OfficerEmailsService } from './officer-emails.service.js';

// E1 and E5: a tender's award or cancellation emails.
@ApiTags('Emails')
@ApiCookieAuth()
@RequireRole('procurement_officer')
@Controller('manage/tenders/:tenderId/emails')
export class TenderEmailsController {
  constructor(private readonly emails: OfficerEmailsService) {}

  @Get()
  @ApiOkResponse({ type: OfficerEmailPage })
  list(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Query() query: EmailListQueryDto,
  ): Promise<OfficerEmailPage> {
    return this.emails.list(tenderId, query);
  }

  // Claims are idempotent by revision; an Idempotency-Key is accepted.
  @Post('send')
  @HttpCode(202)
  @ApiBody({ type: SendAllDto })
  @ApiAcceptedResponse({ type: SendAllResult })
  sendAll(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<SendAllResult> {
    return this.emails.sendAll(tenderId, body, user.id);
  }
}

// E2–E4: one email.
@ApiTags('Emails')
@ApiCookieAuth()
@RequireRole('procurement_officer')
@Controller('manage/emails/:emailId')
export class OfficerEmailController {
  constructor(private readonly emails: OfficerEmailsService) {}

  @Get()
  @ApiOkResponse({ type: OfficerEmail })
  detail(@Param('emailId', ParseUUIDPipe) emailId: string): Promise<OfficerEmail> {
    return this.emails.detail(emailId);
  }

  @Patch()
  @ApiBody({ type: EditEmailDto })
  @ApiOkResponse({ type: RevisionResult })
  @ApiConflictResponse({ description: 'VERSION_CONFLICT or EMAIL_NOT_EDITABLE' })
  edit(
    @Param('emailId', ParseUUIDPipe) emailId: string,
    @Body() body: unknown,
  ): Promise<RevisionResult> {
    return this.emails.edit(emailId, body);
  }

  @Post('send')
  @ApiBody({ type: SendEmailDto })
  @ApiAcceptedResponse({ type: SendResult, description: 'Delivery scheduled' })
  @ApiOkResponse({ type: SendResult, description: 'Already sending or sent' })
  @ApiConflictResponse({ description: 'VERSION_CONFLICT' })
  async send(
    @Param('emailId', ParseUUIDPipe) emailId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SendResult> {
    const result = await this.emails.send(emailId, body, user.id);
    res.status(result.started ? 202 : 200);
    return result.body;
  }
}
