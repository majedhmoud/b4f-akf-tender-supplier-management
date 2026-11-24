import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { PublicCache } from '../common/http/cache-control.js';
import { PageMeta, PageQueryDto, pageArgs, pageMeta } from '../common/pagination/pagination.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class TenderCategoryView {
  // Labels live in the app translations, keyed by this code (ERD A7).
  @ApiProperty({ example: 'construction' }) code: string;
}

export class TenderCategoryPage {
  @ApiProperty({ type: [TenderCategoryView] }) data: TenderCategoryView[];
  @ApiProperty({ type: PageMeta }) meta: PageMeta;
}

// R1 in API_CONTRACT.md §2, "Reference": the fixed, seeded category list.
// Paged like every collection (§1.6), and publicly cacheable (§1.2).
@ApiTags('Reference')
@Public()
@Controller('reference')
export class ReferenceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('tender-categories')
  @PublicCache()
  @ApiOkResponse({ type: TenderCategoryPage })
  async categories(@Query() query: PageQueryDto): Promise<TenderCategoryPage> {
    const [total, data] = await this.prisma.$transaction([
      this.prisma.tenderCategory.count(),
      this.prisma.tenderCategory.findMany({ orderBy: { code: 'asc' }, ...pageArgs(query) }),
    ]);
    return { data, meta: pageMeta(query, total) };
  }
}
