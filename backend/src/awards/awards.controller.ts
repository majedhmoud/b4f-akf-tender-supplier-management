import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { RequireRole } from '../auth/require-role.guard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { PageQueryDto } from '../common/pagination/pagination.js';
import { AwardsService } from './awards.service.js';
import { AwardStatus, RankingPage, TieBreakDto, TieBreakResult } from './dto/award.dto.js';

// W1–W3, for the procurement_officer.
@ApiTags('Award')
@ApiCookieAuth()
@RequireRole('procurement_officer')
@Controller('manage/tenders/:tenderId')
export class AwardsController {
  constructor(private readonly awards: AwardsService) {}

  @Get('award-status')
  @ApiOkResponse({ type: AwardStatus })
  status(@Param('tenderId', ParseUUIDPipe) tenderId: string): Promise<AwardStatus> {
    return this.awards.status(tenderId);
  }

  @Get('ranking')
  @ApiOkResponse({ type: RankingPage })
  ranking(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Query() query: PageQueryDto,
  ): Promise<RankingPage> {
    return this.awards.ranking(tenderId, query);
  }

  @Post('award')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID per action' })
  @ApiBody({ type: TieBreakDto })
  @ApiOkResponse({ type: TieBreakResult })
  @ApiConflictResponse({ description: 'TIE_BREAK_NOT_REQUIRED or ALREADY_AWARDED' })
  @ApiUnprocessableEntityResponse({ description: 'BID_NOT_TIE_CANDIDATE' })
  async award(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TieBreakResult> {
    const result = await this.awards.breakTie(user.id, tenderId, body, key);
    if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
    return result.body;
  }
}
