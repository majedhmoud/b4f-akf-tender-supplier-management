import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequireRole } from '../auth/require-role.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RequestedLanguage } from '../common/language/language.js';
import { PageQueryDto } from '../common/pagination/pagination.js';
import type { Language } from '../generated/prisma/client.js';
import {
  CreatedTender,
  EmployeeTender,
  EmployeeTenderPage,
  TenderRevision,
} from './dto/employee-tender.dto.js';
import { CreateDraftTenderDto, UpdateDraftTenderDto } from './dto/tender-input.dto.js';
import { DownloadLink } from './dto/managed-tender.dto.js';
import { EmployeeTendersService } from './employee-tenders.service.js';
import { TenderDocumentsService } from './tender-documents.service.js';

// Q1–Q5 in API_CONTRACT.md §2, "Employee Tenders". Only an `employee`, and
// only for their own tenders.
@ApiTags('Employee Tenders')
@ApiCookieAuth()
@RequireRole('employee')
@Controller('employee/tenders')
export class EmployeeTendersController {
  constructor(
    private readonly tendersService: EmployeeTendersService,
    private readonly documents: TenderDocumentsService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: CreatedTender })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDraftTenderDto,
    @Req() req: Request,
  ): Promise<CreatedTender> {
    return this.tendersService.create(user.id, dto, req.requestId);
  }

  @Get()
  @ApiOkResponse({ type: EmployeeTenderPage })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PageQueryDto,
    @RequestedLanguage() language: Language,
  ): Promise<EmployeeTenderPage> {
    return this.tendersService.list(user.id, query, language);
  }

  @Get(':tenderId')
  @ApiOkResponse({ type: EmployeeTender })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
  ): Promise<EmployeeTender> {
    return this.tendersService.findOne(user.id, tenderId);
  }

  // The body is validated inside the service, after the status and revision
  // checks, to keep the contract's check order (API_CONTRACT.md §1.4).
  @Patch(':tenderId')
  @ApiBody({ type: UpdateDraftTenderDto })
  @ApiOkResponse({ type: TenderRevision })
  @ApiConflictResponse({ description: 'TENDER_STATUS_CHANGED or VERSION_CONFLICT' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Body() body: unknown,
  ): Promise<TenderRevision> {
    return this.tendersService.update(user.id, tenderId, body);
  }

  // Q5: files of the employee's own tender, through a short-lived signed URL.
  @Get(':tenderId/documents/:docId/download')
  @ApiOkResponse({ type: DownloadLink })
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ): Promise<DownloadLink> {
    return this.documents.employeeDownload(user.id, tenderId, docId);
  }
}
