import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RequireRole } from '../auth/require-role.guard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { RequestedLanguage } from '../common/language/language.js';
import { PageQueryDto } from '../common/pagination/pagination.js';
import { CommitteeType, Language } from '../generated/prisma/client.js';
import { CommitteesService } from './committees.service.js';
import {
  AdminNominationPage,
  ApproveNominationDto,
  AssignmentPage,
  CommitteePage,
  CommitteeRaised,
  NominateDto,
  NominationCreated,
  NominationDecision,
  NominationQueryDto,
  RaiseCommitteeDto,
} from './dto/committee.dto.js';

// C1–C3: a tender's committees, for the procurement_officer.
@ApiTags('Committees')
@ApiCookieAuth()
@RequireRole('procurement_officer')
@Controller('manage/tenders/:tenderId/committees')
export class TenderCommitteesController {
  constructor(private readonly committees: CommitteesService) {}

  @Get()
  @ApiOkResponse({ type: CommitteePage })
  list(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Query() query: PageQueryDto,
  ): Promise<CommitteePage> {
    return this.committees.list(tenderId, query);
  }

  @Post()
  @ApiBody({ type: RaiseCommitteeDto })
  @ApiCreatedResponse({ type: CommitteeRaised, description: 'Or 200 when already raised' })
  @ApiConflictResponse({ description: 'TENDER_STATUS_CHANGED' })
  async raise(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CommitteeRaised> {
    const result = await this.committees.raise(tenderId, user.id, body, req.requestId);
    if (!result.created) res.status(200);
    return result.body;
  }

  @Post(':type/nominations')
  @ApiBody({ type: NominateDto })
  @ApiCreatedResponse({ type: NominationCreated })
  @ApiConflictResponse({ description: 'TENDER_STATUS_CHANGED' })
  nominate(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('type', new ParseEnumPipe(CommitteeType)) type: CommitteeType,
    @Body() body: unknown,
  ): Promise<NominationCreated> {
    return this.committees.nominate(tenderId, type, body);
  }
}

// C4.
@ApiTags('Committees')
@ApiCookieAuth()
@RequireRole('procurement_officer')
@Controller('manage/nominations')
export class NominationsController {
  constructor(private readonly committees: CommitteesService) {}

  @Delete(':nominationId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Withdrawn' })
  @ApiConflictResponse({ description: 'ASSIGNMENT_ALREADY_DECIDED' })
  withdraw(@Param('nominationId', ParseUUIDPipe) id: string): Promise<void> {
    return this.committees.withdraw(id);
  }
}

// C5–C6: the admin's nomination queue and decisions.
@ApiTags('Committees')
@ApiCookieAuth()
@RequireRole('admin')
@Controller('admin/committee-nominations')
export class AdminNominationsController {
  constructor(private readonly committees: CommitteesService) {}

  @Get()
  @ApiOkResponse({ type: AdminNominationPage })
  list(
    @Query() query: NominationQueryDto,
    @RequestedLanguage() language: Language,
  ): Promise<AdminNominationPage> {
    return this.committees.queue(query, language);
  }

  @Post(':nominationId/approve')
  @HttpCode(200)
  @ApiBody({ type: ApproveNominationDto, required: false })
  @ApiOkResponse({ type: NominationDecision })
  @ApiConflictResponse({
    description:
      'ASSIGNMENT_ONE_COMMITTEE_PER_TENDER, ASSIGNMENT_REQUESTING_EMPLOYEE_CONFLICT, ASSIGNMENT_STAFF_CONFLICT, ASSIGNMENT_ALREADY_DECIDED or TENDER_STATUS_CHANGED',
  })
  approve(
    @Param('nominationId', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<NominationDecision> {
    return this.committees.approve(id, user.id, body, req.requestId);
  }

  @Post(':nominationId/reject')
  @HttpCode(200)
  @ApiOkResponse({ type: NominationDecision })
  @ApiConflictResponse({ description: 'ASSIGNMENT_ALREADY_DECIDED' })
  reject(
    @Param('nominationId', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NominationDecision> {
    return this.committees.reject(id, user.id);
  }
}

// C7: any signed-in user.
@ApiTags('Committees')
@ApiCookieAuth()
@Controller('me/assignments')
export class MyAssignmentsController {
  constructor(private readonly committees: CommitteesService) {}

  @Get()
  @ApiOkResponse({ type: AssignmentPage })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PageQueryDto,
    @RequestedLanguage() language: Language,
  ): Promise<AssignmentPage> {
    return this.committees.mine(user.id, query, language);
  }
}
