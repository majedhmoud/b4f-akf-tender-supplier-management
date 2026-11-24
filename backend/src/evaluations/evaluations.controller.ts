import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { RequestedLanguage } from '../common/language/language.js';
import { PageQueryDto } from '../common/pagination/pagination.js';
import { Language } from '../generated/prisma/client.js';
import { DownloadLink } from '../tenders/dto/managed-tender.dto.js';
import {
  BlindQueuePage,
  FinancialBidView,
  FinancialEvaluationDto,
  FinancialEvaluationView,
  LegalBidView,
  LegalEvaluationDto,
  LegalEvaluationView,
  LegalQueuePage,
  TechnicalBidView,
  TechnicalEvaluationDto,
  TechnicalEvaluationView,
} from './dto/evaluation.dto.js';
import { EvaluationsService } from './evaluations.service.js';

// Access comes only from an approved assignment on the tender, checked in the
// service; committee members may hold no account role at all.
const statusConflict = ApiConflictResponse({
  description: 'TENDER_STATUS_CHANGED, or ALREADY_SUBMITTED with details.evaluation',
});

// L1–L4.
@ApiTags('Evaluations')
@ApiCookieAuth()
@Controller('evaluations/legal/tenders/:tenderId/bids')
export class LegalEvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get()
  @ApiOkResponse({ type: LegalQueuePage })
  @statusConflict
  queue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Query() query: PageQueryDto,
  ) {
    return this.evaluations.queue(user.id, tenderId, 'legal', query);
  }

  @Get(':bidId')
  @ApiOkResponse({ type: LegalBidView })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @RequestedLanguage() language: Language,
  ) {
    return this.evaluations.legalDetail(user.id, tenderId, bidId, language);
  }

  @Post(':bidId/evaluation')
  @ApiBody({ type: LegalEvaluationDto })
  @ApiCreatedResponse({ type: LegalEvaluationView })
  @statusConflict
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.evaluations.submit(user.id, tenderId, 'legal', bidId, body, req.requestId);
  }

  @Get(':bidId/documents/:docId/download')
  @ApiOkResponse({ type: DownloadLink })
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.evaluations.download(user.id, tenderId, 'legal', bidId, docId);
  }
}

// X1–X4: by bidder code only.
@ApiTags('Evaluations')
@ApiCookieAuth()
@Controller('evaluations/technical/tenders/:tenderId/bids')
export class TechnicalEvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get()
  @ApiOkResponse({ type: BlindQueuePage })
  @statusConflict
  queue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Query() query: PageQueryDto,
  ) {
    return this.evaluations.queue(user.id, tenderId, 'technical', query);
  }

  @Get(':bidderCode')
  @ApiOkResponse({ type: TechnicalBidView })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('bidderCode') code: string,
    @RequestedLanguage() language: Language,
  ) {
    return this.evaluations.blindDetail(user.id, tenderId, 'technical', code, language);
  }

  @Post(':bidderCode/evaluation')
  @ApiBody({ type: TechnicalEvaluationDto })
  @ApiCreatedResponse({ type: TechnicalEvaluationView })
  @statusConflict
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('bidderCode') code: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.evaluations.submit(user.id, tenderId, 'technical', code, body, req.requestId);
  }

  @Get(':bidderCode/documents/:docId/download')
  @ApiOkResponse({ type: DownloadLink })
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('bidderCode') code: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.evaluations.download(user.id, tenderId, 'technical', code, docId);
  }
}

// F1–F4: by bidder code only.
@ApiTags('Evaluations')
@ApiCookieAuth()
@Controller('evaluations/financial/tenders/:tenderId/bids')
export class FinancialEvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get()
  @ApiOkResponse({ type: BlindQueuePage })
  @statusConflict
  queue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Query() query: PageQueryDto,
  ) {
    return this.evaluations.queue(user.id, tenderId, 'financial', query);
  }

  @Get(':bidderCode')
  @ApiOkResponse({ type: FinancialBidView })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('bidderCode') code: string,
    @RequestedLanguage() language: Language,
  ) {
    return this.evaluations.blindDetail(user.id, tenderId, 'financial', code, language);
  }

  @Post(':bidderCode/evaluation')
  @ApiBody({ type: FinancialEvaluationDto })
  @ApiCreatedResponse({ type: FinancialEvaluationView })
  @statusConflict
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('bidderCode') code: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.evaluations.submit(user.id, tenderId, 'financial', code, body, req.requestId);
  }

  @Get(':bidderCode/documents/:docId/download')
  @ApiOkResponse({ type: DownloadLink })
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('bidderCode') code: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.evaluations.download(user.id, tenderId, 'financial', code, docId);
  }
}
