import { Injectable } from '@nestjs/common';
import { AccessService } from '../auth/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { validateBody } from '../common/errors/validate-body.js';
import { pickTranslation } from '../common/language/language.js';
import { PageQueryDto, pageArgs, pageMeta } from '../common/pagination/pagination.js';
import type { Language, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreatedTender,
  EmployeeTender,
  EmployeeTenderPage,
  TenderRevision,
} from './dto/employee-tender.dto.js';
import { CreateDraftTenderDto, UpdateDraftTenderDto } from './dto/tender-input.dto.js';
import {
  assertCategoryExists,
  assertEditable,
  assertOneTranslationPerLanguage,
  bumpRevision,
} from './tender-rules.js';
import { toDeadlines, toDocumentViews, tenderDocumentsInclude } from './tender-views.js';

// Q1–Q4 in API_CONTRACT.md §2: the requesting employee's draft tenders.
// Q5 (document download) is in TenderDocumentsService.
@Injectable()
export class EmployeeTendersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async create(
    userId: string,
    dto: CreateDraftTenderDto,
    requestId?: string,
  ): Promise<CreatedTender> {
    await assertCategoryExists(this.prisma, dto.categoryCode);
    assertOneTranslationPerLanguage(dto.translations);

    return this.prisma.$transaction(async (tx) => {
      const tender = await tx.tender.create({
        data: {
          categoryCode: dto.categoryCode,
          requestedByUserId: userId,
          estimatedBalance: dto.estimatedBalance.amount,
          currencyCode: dto.estimatedBalance.currency,
          translations: { create: dto.translations },
        },
        select: { id: true, status: true, revision: true },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'draft_tender.created',
          resourceType: 'tender',
          resourceId: tender.id,
          requestId,
        },
        tx,
      );
      return tender;
    });
  }

  async list(userId: string, query: PageQueryDto, language: Language): Promise<EmployeeTenderPage> {
    const where: Prisma.TenderWhereInput = { requestedByUserId: userId };
    const [total, tenders] = await this.prisma.$transaction([
      this.prisma.tender.count({ where }),
      this.prisma.tender.findMany({
        where,
        // Newest first; the id breaks ties so paging stays stable.
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...pageArgs(query),
        select: {
          id: true,
          status: true,
          categoryCode: true,
          createdAt: true,
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
          createdAt: tender.createdAt.toISOString(),
        };
      }),
      meta: pageMeta(query, total),
    };
  }

  async findOne(userId: string, tenderId: string): Promise<EmployeeTender> {
    await this.access.employeeTender(userId, tenderId);
    const tender = await this.prisma.tender.findUniqueOrThrow({
      where: { id: tenderId },
      select: {
        id: true,
        status: true,
        revision: true,
        categoryCode: true,
        estimatedBalance: true,
        currencyCode: true,
        applicationDeadline: true,
        technicalDeadline: true,
        financialDeadline: true,
        cancellationReason: true,
        translations: { select: { language: true, title: true, description: true } },
        documents: tenderDocumentsInclude,
      },
    });

    return {
      id: tender.id,
      status: tender.status,
      revision: tender.revision,
      categoryCode: tender.categoryCode,
      estimatedBalance: {
        amount: tender.estimatedBalance.toFixed(2),
        currency: tender.currencyCode,
      },
      translations: tender.translations,
      deadlines: toDeadlines(tender),
      documents: toDocumentViews(tender.documents),
      cancellationReason: tender.cancellationReason,
      allowedActions: tender.status === 'draft' ? ['edit'] : [],
    };
  }

  // Checked in the contract's order: visibility (404), status (409), revision
  // (409), then fields (400). See API_CONTRACT.md §1.4.
  async update(userId: string, tenderId: string, body: unknown): Promise<TenderRevision> {
    const tender = await this.access.employeeTender(userId, tenderId);
    assertEditable(tender, 'draft', (body as { revision?: unknown } | null)?.revision);

    const dto = await validateBody(UpdateDraftTenderDto, body);
    if (dto.categoryCode) await assertCategoryExists(this.prisma, dto.categoryCode);
    if (dto.translations) assertOneTranslationPerLanguage(dto.translations);
    if (!dto.categoryCode && !dto.estimatedBalance && !dto.translations) {
      return { revision: tender.revision };
    }

    const revision = await this.prisma.$transaction(async (tx) => {
      const next = await bumpRevision(
        tx,
        tenderId,
        { status: 'draft', revision: dto.revision },
        {
          ...(dto.categoryCode ? { categoryCode: dto.categoryCode } : {}),
          ...(dto.estimatedBalance
            ? {
                estimatedBalance: dto.estimatedBalance.amount,
                currencyCode: dto.estimatedBalance.currency,
              }
            : {}),
        },
      );
      if (dto.translations) {
        await tx.tenderTranslation.deleteMany({ where: { tenderId } });
        await tx.tenderTranslation.createMany({
          data: dto.translations.map((t) => ({ ...t, tenderId })),
        });
      }
      return next;
    });

    return { revision };
  }
}
