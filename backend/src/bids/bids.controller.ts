import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RequireRole } from '../auth/require-role.guard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { RequestedLanguage } from '../common/language/language.js';
import { PageQueryDto } from '../common/pagination/pagination.js';
import { Language, PartType } from '../generated/prisma/client.js';
import { MAX_UPLOAD_BYTES } from '../storage/upload-rules.js';
import { DownloadLink } from '../tenders/dto/managed-tender.dto.js';
import { BidAccessGuard } from './bid-access.guard.js';
import { BidsService, type BidUpload } from './bids.service.js';
import { BidForm, BidPage, BidPartView, SupplierBid } from './dto/bid.dto.js';

const uploads = AnyFilesInterceptor({
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 20, fields: 60 },
});
const idempotencyHeader = ApiHeader({
  name: 'Idempotency-Key',
  required: true,
  description: 'UUID per action; reuse it on retries.',
});

// B1–B2: the bid form and submission on a published tender.
@ApiTags('Bids')
@ApiCookieAuth()
@RequireRole('supplier')
@Controller('tenders/:tenderId')
export class TenderBidsController {
  constructor(private readonly bids: BidsService) {}

  @Get('bid-form')
  @ApiOkResponse({ type: BidForm })
  form(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @RequestedLanguage() language: Language,
  ): Promise<BidForm> {
    return this.bids.form(user.id, tenderId, language);
  }

  @Post('bids')
  @UseGuards(BidAccessGuard)
  @UseInterceptors(uploads)
  @ApiConsumes('multipart/form-data')
  @idempotencyHeader
  @ApiBody({
    schema: {
      type: 'object',
      required: ['bid'],
      properties: {
        bid: {
          type: 'string',
          example: '{"legalInformation":{"authorizedSignatoryName":"Hiba Saleh"},"answers":{}}',
        },
        'files[legal_information][registration_certificate]': { type: 'string', format: 'binary' },
        'languages[legal_information][registration_certificate]': { type: 'string', example: 'ar' },
        'files[technical_offer][technical_proposal]': { type: 'string', format: 'binary' },
        'languages[technical_offer][technical_proposal]': { type: 'string', example: 'en' },
        'files[financial_offer][financial_proposal]': { type: 'string', format: 'binary' },
        'languages[financial_offer][financial_proposal]': { type: 'string', example: 'en' },
      },
    },
  })
  @ApiCreatedResponse({ type: SupplierBid })
  @ApiConflictResponse({ description: 'BID_EXISTS, with bidId and allowedActions in details' })
  @ApiUnprocessableEntityResponse({ description: 'SUPPLIER_SUSPENDED or APPLICATION_CLOSED' })
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: BidUpload[] | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @RequestedLanguage() language: Language,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SupplierBid> {
    const result = await this.bids.submit(
      user.id,
      tenderId,
      body ?? {},
      files ?? [],
      key,
      language,
      req.requestId,
    );
    if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
    return result.body;
  }
}

// B3, B3d, B4 and B6: the supplier's own bids.
@ApiTags('Bids')
@ApiCookieAuth()
@RequireRole('supplier')
@Controller('me/bids')
export class MyBidsController {
  constructor(private readonly bids: BidsService) {}

  @Get()
  @ApiOkResponse({ type: BidPage })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PageQueryDto,
    @RequestedLanguage() language: Language,
  ): Promise<BidPage> {
    return this.bids.mine(user.id, query, language);
  }

  @Get(':bidId')
  @ApiOkResponse({ type: SupplierBid })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @RequestedLanguage() language: Language,
  ): Promise<SupplierBid> {
    return this.bids.detail(user.id, bidId, language);
  }

  @Put(':bidId/parts/:partType')
  @UseGuards(BidAccessGuard)
  @UseInterceptors(uploads)
  @ApiConsumes('multipart/form-data')
  @idempotencyHeader
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        'files[technical_proposal]': { type: 'string', format: 'binary' },
        'languages[technical_proposal]': { type: 'string', example: 'en' },
        legalInformation: {
          type: 'string',
          description: 'legal_information only',
          example: '{"authorizedSignatoryName":"Hiba Saleh"}',
        },
        answers: { type: 'string', example: '{}' },
      },
    },
  })
  @ApiOkResponse({ type: BidPartView })
  @ApiUnprocessableEntityResponse({ description: 'BID_PART_LOCKED' })
  async replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @Param('partType', new ParseEnumPipe(PartType)) partType: PartType,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: BidUpload[] | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @RequestedLanguage() language: Language,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BidPartView> {
    const result = await this.bids.replace(
      user.id,
      bidId,
      partType,
      body ?? {},
      files ?? [],
      key,
      language,
      req.requestId,
    );
    if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
    return result.body;
  }

  @Get(':bidId/documents/:docId/download')
  @ApiOkResponse({ type: DownloadLink })
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ): Promise<DownloadLink> {
    return this.bids.download(user.id, bidId, docId);
  }
}
