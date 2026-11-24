import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequireRole } from '../auth/require-role.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RequestedLanguage } from '../common/language/language.js';
import type { Language } from '../generated/prisma/client.js';
import { MAX_UPLOAD_BYTES, type UploadedFileInput } from '../storage/upload-rules.js';
import { BidFormService } from './bid-form.service.js';
import { BidFormEditorView, SaveBidFormDto } from './dto/bid-form.dto.js';
import { TenderRevision } from './dto/employee-tender.dto.js';
import {
  AcceptTenderDto,
  ManagedTenderQueryDto,
  PublishTenderDto,
  UpdateManagedTenderDto,
} from './dto/manage-input.dto.js';
import {
  AcceptedTender,
  CopiedTender,
  DownloadLink,
  ManagedTender,
  ManagedTenderPage,
  PublishedTender,
  UploadedDocumentResult,
} from './dto/managed-tender.dto.js';
import { ManagedTendersService } from './managed-tenders.service.js';
import { TenderDocumentsService } from './tender-documents.service.js';

// M1–M11 in API_CONTRACT.md §2, "Tender Management": the procurement officer
// only. Bodies that change a tender are validated inside the services, after
// the status and revision checks (API_CONTRACT.md §1.4).
@ApiTags('Tender Management')
@ApiCookieAuth()
@RequireRole('procurement_officer')
@Controller('manage/tenders')
export class ManageTendersController {
  constructor(
    private readonly tenders: ManagedTendersService,
    private readonly documents: TenderDocumentsService,
    private readonly bidForm: BidFormService,
  ) {}

  @Get()
  @ApiOkResponse({ type: ManagedTenderPage })
  list(
    @Query() query: ManagedTenderQueryDto,
    @RequestedLanguage() language: Language,
  ): Promise<ManagedTenderPage> {
    return this.tenders.list(query, language);
  }

  @Get(':tenderId')
  @ApiOkResponse({ type: ManagedTender })
  findOne(@Param('tenderId', ParseUUIDPipe) tenderId: string): Promise<ManagedTender> {
    return this.tenders.findOne(tenderId);
  }

  @Post(':tenderId/accept')
  @HttpCode(200)
  @ApiBody({ type: AcceptTenderDto })
  @ApiOkResponse({ type: AcceptedTender })
  @ApiConflictResponse({ description: 'TENDER_STATUS_CHANGED or VERSION_CONFLICT' })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<AcceptedTender> {
    return this.tenders.accept(user.id, tenderId, body, req.requestId);
  }

  @Patch(':tenderId')
  @ApiBody({ type: UpdateManagedTenderDto })
  @ApiOkResponse({ type: TenderRevision })
  update(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Body() body: unknown,
  ): Promise<TenderRevision> {
    return this.tenders.update(tenderId, body);
  }

  @Post(':tenderId/documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['revision', 'kind', 'language', 'file'],
      properties: {
        revision: { type: 'integer' },
        kind: { type: 'string', enum: ['terms_of_reference', 'other'] },
        language: { type: 'string', example: 'ar' },
        translationOf: { type: 'string', format: 'uuid' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: UploadedDocumentResult })
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Body() body: unknown,
    @UploadedFile() file: UploadedFileInput | undefined,
  ): Promise<UploadedDocumentResult> {
    return this.documents.upload(user.id, tenderId, body, file);
  }

  @Delete(':tenderId/documents/:docId')
  @ApiQuery({ name: 'revision', type: Number })
  @ApiOkResponse({ type: TenderRevision })
  removeDocument(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Query() query: unknown,
  ): Promise<TenderRevision> {
    return this.documents.remove(tenderId, docId, query);
  }

  @Get(':tenderId/documents/:docId/download')
  @ApiOkResponse({ type: DownloadLink })
  download(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ): Promise<DownloadLink> {
    return this.documents.managedDownload(tenderId, docId);
  }

  @Post(':tenderId/publish')
  @HttpCode(200)
  @ApiBody({ type: PublishTenderDto })
  @ApiOkResponse({ type: PublishedTender })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<PublishedTender> {
    return this.tenders.publish(user.id, tenderId, body, req.requestId);
  }

  @Post(':tenderId/copy')
  @ApiCreatedResponse({ type: CopiedTender })
  @ApiConflictResponse({ description: 'TENDER_NOT_CANCELLED or TENDER_ALREADY_COPIED' })
  copy(@Param('tenderId', ParseUUIDPipe) tenderId: string): Promise<CopiedTender> {
    return this.tenders.copy(tenderId);
  }

  @Get(':tenderId/bid-form')
  @ApiOkResponse({ type: BidFormEditorView })
  getBidForm(@Param('tenderId', ParseUUIDPipe) tenderId: string): Promise<BidFormEditorView> {
    return this.bidForm.view(tenderId);
  }

  @Put(':tenderId/bid-form')
  @ApiBody({ type: SaveBidFormDto })
  @ApiOkResponse({ type: BidFormEditorView })
  saveBidForm(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Body() body: unknown,
  ): Promise<BidFormEditorView> {
    return this.bidForm.save(tenderId, body);
  }
}
