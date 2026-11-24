import { Injectable } from '@nestjs/common';
import { notFound } from '../auth/access.service.js';
import { pickTranslation } from '../common/language/language.js';
import { pageArgs, pageMeta } from '../common/pagination/pagination.js';
import type { Language, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SignedUrlService, type SignedDownload } from '../storage/signed-url.service.js';
import type {
  PublicTender,
  PublicTenderPage,
  PublicTenderQueryDto,
} from './dto/public-tender.dto.js';
import { toDeadlines, toDocumentViews, tenderDocumentsInclude } from './tender-views.js';

// Only published tenders are public. Any other status answers 404, as if the
// tender did not exist (API_CONTRACT.md, Public Tenders).
const PUBLISHED: Prisma.TenderWhereInput = { status: 'published' };

// T1, T2, and T2d in API_CONTRACT.md §2, for anyone, signed in or not.
@Injectable()
export class PublicTendersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signedUrls: SignedUrlService,
  ) {}

  async list(query: PublicTenderQueryDto, language: Language): Promise<PublicTenderPage> {
    const where: Prisma.TenderWhereInput = {
      ...PUBLISHED,
      ...(query.category ? { categoryCode: query.category } : {}),
    };
    const [total, tenders] = await this.prisma.$transaction([
      this.prisma.tender.count({ where }),
      this.prisma.tender.findMany({
        where,
        // Newest publications first; the id breaks ties so paging stays stable.
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        ...pageArgs(query),
        select: {
          id: true,
          status: true,
          categoryCode: true,
          applicationDeadline: true,
          translations: { select: { language: true, title: true } },
        },
      }),
    ]);

    return {
      data: tenders.map((tender) => {
        const { content, requestedLanguage, isFallback } = pickTranslation(
          tender.translations,
          language,
        );
        return {
          id: tender.id,
          status: tender.status,
          categoryCode: tender.categoryCode,
          content,
          requestedLanguage,
          isFallback,
          // Every published tender has its deadlines (ERD, CHECK constraints).
          applicationDeadline: tender.applicationDeadline!.toISOString(),
        };
      }),
      meta: pageMeta(query, total),
    };
  }

  async findOne(tenderId: string, language: Language): Promise<PublicTender> {
    const tender = await this.prisma.tender.findFirst({
      where: { id: tenderId, ...PUBLISHED },
      select: {
        id: true,
        status: true,
        categoryCode: true,
        applicationDeadline: true,
        technicalDeadline: true,
        financialDeadline: true,
        translations: { select: { language: true, title: true, description: true } },
        documents: tenderDocumentsInclude,
      },
    });
    if (!tender) throw notFound();

    const { content, requestedLanguage, isFallback, availableLanguages } = pickTranslation(
      tender.translations,
      language,
    );
    return {
      id: tender.id,
      status: tender.status,
      categoryCode: tender.categoryCode,
      content,
      requestedLanguage,
      isFallback,
      availableLanguages,
      deadlines: toDeadlines(tender)!,
      documents: toDocumentViews(tender.documents),
      // Countdowns anchor to GET /auth/csrf, never to this cached value
      // (API_CONTRACT.md §1.1).
      serverTime: new Date().toISOString(),
    };
  }

  // T2d: files of a published tender, for anyone (API_CONTRACT.md §1.8).
  async download(tenderId: string, documentId: string): Promise<SignedDownload> {
    const link = await this.prisma.tenderDocument.findFirst({
      where: { tenderId, documentId, tender: PUBLISHED },
      select: { document: { select: { storageKey: true, originalName: true } } },
    });
    if (!link) throw notFound();
    return this.signedUrls.sign(link.document.storageKey, link.document.originalName);
  }
}
