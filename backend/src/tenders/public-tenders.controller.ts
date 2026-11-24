import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { PublicCache } from '../common/http/cache-control.js';
import { RequestedLanguage } from '../common/language/language.js';
import type { Language } from '../generated/prisma/client.js';
import { DownloadLink } from './dto/managed-tender.dto.js';
import { PublicTender, PublicTenderPage, PublicTenderQueryDto } from './dto/public-tender.dto.js';
import { PublicTendersService } from './public-tenders.service.js';

// T1, T2, T2d in API_CONTRACT.md §2, "Public Tenders". Anyone, signed in or
// not. Only the list and the detail may be cached publicly; the download link
// may not (API_CONTRACT.md §1.2).
@ApiTags('Public Tenders')
@Public()
@Controller('tenders')
export class PublicTendersController {
  constructor(private readonly tenders: PublicTendersService) {}

  @Get()
  @PublicCache()
  @ApiOkResponse({ type: PublicTenderPage })
  list(
    @Query() query: PublicTenderQueryDto,
    @RequestedLanguage() language: Language,
  ): Promise<PublicTenderPage> {
    return this.tenders.list(query, language);
  }

  @Get(':tenderId')
  @PublicCache()
  @ApiOkResponse({ type: PublicTender })
  async findOne(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @RequestedLanguage() language: Language,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicTender> {
    const tender = await this.tenders.findOne(tenderId, language);
    // Public content responses name their content language (API_CONTRACT.md §1.7).
    res.setHeader('Content-Language', tender.content.language);
    return tender;
  }

  @Get(':tenderId/documents/:docId/download')
  @ApiOkResponse({ type: DownloadLink })
  download(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ): Promise<DownloadLink> {
    return this.tenders.download(tenderId, docId);
  }
}
