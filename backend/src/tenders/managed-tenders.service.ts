import { HttpStatus, Injectable } from '@nestjs/common';
import { AccessService } from '../auth/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/errors/api-exception.js';
import { validateBody } from '../common/errors/validate-body.js';
import { pickTranslation } from '../common/language/language.js';
import { pageArgs, pageMeta } from '../common/pagination/pagination.js';
import { Prisma, type Language, type TenderStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import type { TenderRevision } from './dto/employee-tender.dto.js';
import {
  AcceptTenderDto,
  ManagedTenderQueryDto,
  PublishTenderDto,
  UpdateManagedTenderDto,
} from './dto/manage-input.dto.js';
import type {
  AcceptedTender,
  CopiedTender,
  ManagedTender,
  ManagedTenderPage,
  PublishedTender,
} from './dto/managed-tender.dto.js';
import {
  assertCategoryExists,
  assertEditable,
  assertOneTranslationPerLanguage,
  bumpRevision,
  fieldErrors,
} from './tender-rules.js';
import { toDeadlines, toDocumentViews, tenderDocumentsInclude } from './tender-views.js';

function weightsError(): ApiException {
  return fieldErrors([{ field: 'technicalWeight', code: 'WEIGHTS_MUST_SUM_TO_100' }]);
}

// The officer's actions, by status (API_CONTRACT.md, Tender Management).
// Committees arrive with S3; the S1 screens hide `raise_committee`.
function allowedActions(status: TenderStatus, copiedIntoTenderId: string | null): string[] {
  switch (status) {
    case 'draft':
      return ['accept'];
    case 'accepted':
      return ['edit', 'upload_terms_of_reference', 'publish', 'raise_committee'];
    case 'published':
    case 'closed':
      return ['raise_committee'];
    case 'cancelled':
      return copiedIntoTenderId ? [] : ['copy'];
    default:
      return [];
  }
}

// M1–M4, M8, M9 in API_CONTRACT.md §2, for the procurement officer.
@Injectable()
export class ManagedTendersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly storage: FileStorage,
  ) {}

  async list(query: ManagedTenderQueryDto, language: Language): Promise<ManagedTenderPage> {
    const where: Prisma.TenderWhereInput = query.status ? { status: query.status } : {};
    const [total, tenders] = await this.prisma.$transaction([
      this.prisma.tender.count({ where }),
      this.prisma.tender.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...pageArgs(query),
        select: {
          id: true,
          status: true,
          categoryCode: true,
          createdAt: true,
          applicationDeadline: true,
          technicalDeadline: true,
          financialDeadline: true,
          requestedBy: { select: { id: true, displayName: true } },
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
          requestedBy: { id: tender.requestedBy.id, name: tender.requestedBy.displayName },
          deadlines: toDeadlines(tender),
          createdAt: tender.createdAt.toISOString(),
        };
      }),
      meta: pageMeta(query, total),
    };
  }

  async findOne(tenderId: string): Promise<ManagedTender> {
    await this.access.managedTender(tenderId);
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
        copiedFromTenderId: true,
        copiedInto: { select: { id: true } },
        requestedBy: { select: { id: true, displayName: true } },
        translations: { select: { language: true, title: true, description: true } },
        scoring: {
          select: { technicalWeight: true, financialWeight: true, minimumTechnicalScore: true },
        },
        documents: tenderDocumentsInclude,
      },
    });
    const copiedIntoTenderId = tender.copiedInto?.id ?? null;

    return {
      id: tender.id,
      status: tender.status,
      revision: tender.revision,
      categoryCode: tender.categoryCode,
      requestedBy: { id: tender.requestedBy.id, name: tender.requestedBy.displayName },
      estimatedBalance: {
        amount: tender.estimatedBalance.toFixed(2),
        currency: tender.currencyCode,
      },
      translations: tender.translations,
      scoring: tender.scoring,
      deadlines: toDeadlines(tender),
      documents: toDocumentViews(tender.documents),
      copiedFromTenderId: tender.copiedFromTenderId,
      copiedIntoTenderId,
      cancellationReason: tender.cancellationReason,
      allowedActions: allowedActions(tender.status, copiedIntoTenderId),
    };
  }

  // M3. Sets the scoring and moves the draft to `accepted`.
  async accept(
    userId: string,
    tenderId: string,
    body: unknown,
    requestId?: string,
  ): Promise<AcceptedTender> {
    const tender = await this.access.managedTender(tenderId);
    assertEditable(tender, 'draft', (body as { revision?: unknown } | null)?.revision);
    const dto = await validateBody(AcceptTenderDto, body);
    if (dto.technicalWeight + dto.financialWeight !== 100) throw weightsError();

    const revision = await this.prisma.$transaction(async (tx) => {
      const next = await bumpRevision(
        tx,
        tenderId,
        { status: 'draft', revision: dto.revision },
        { status: 'accepted', acceptedAt: new Date() },
      );
      await tx.tenderScoring.create({
        data: {
          tenderId,
          technicalWeight: dto.technicalWeight,
          financialWeight: dto.financialWeight,
          minimumTechnicalScore: dto.minimumTechnicalScore,
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'draft_tender.accepted',
          resourceType: 'tender',
          resourceId: tenderId,
          requestId,
        },
        tx,
      );
      return next;
    });
    return { status: 'accepted', revision };
  }

  // M4. Edits details and scoring while `accepted`; locked from publication.
  async update(tenderId: string, body: unknown): Promise<TenderRevision> {
    const tender = await this.access.managedTender(tenderId);
    assertEditable(tender, 'accepted', (body as { revision?: unknown } | null)?.revision);
    const dto = await validateBody(UpdateManagedTenderDto, body);
    if (dto.scoring && dto.scoring.technicalWeight + dto.scoring.financialWeight !== 100) {
      throw weightsError();
    }
    if (dto.categoryCode) await assertCategoryExists(this.prisma, dto.categoryCode);
    if (dto.translations) assertOneTranslationPerLanguage(dto.translations);
    if (!dto.categoryCode && !dto.estimatedBalance && !dto.translations && !dto.scoring) {
      return { revision: tender.revision };
    }

    const revision = await this.prisma.$transaction(async (tx) => {
      const next = await bumpRevision(
        tx,
        tenderId,
        { status: 'accepted', revision: dto.revision },
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
      if (dto.scoring) {
        await tx.tenderScoring.update({ where: { tenderId }, data: dto.scoring });
      }
      return next;
    });
    return { revision };
  }

  // M8. Sets the deadlines and publishes. From here on the content, scoring,
  // deadlines, Terms of Reference, and bid form are read-only.
  async publish(
    userId: string,
    tenderId: string,
    body: unknown,
    requestId?: string,
  ): Promise<PublishedTender> {
    const tender = await this.access.managedTender(tenderId);
    assertEditable(tender, 'accepted', (body as { revision?: unknown } | null)?.revision);
    const dto = await validateBody(PublishTenderDto, body);

    const application = new Date(dto.deadlines.application);
    const technical = new Date(dto.deadlines.technical);
    const financial = new Date(dto.deadlines.financial);
    if (!(application < technical && technical < financial)) {
      throw fieldErrors([{ field: 'deadlines', code: 'DEADLINES_OUT_OF_ORDER' }]);
    }
    if (application <= new Date()) {
      throw fieldErrors([{ field: 'deadlines.application', code: 'DEADLINE_IN_PAST' }]);
    }
    await assertCategoryExists(this.prisma, dto.categoryCode);

    const publishedAt = new Date();
    const revision = await this.prisma.$transaction(async (tx) => {
      const next = await bumpRevision(
        tx,
        tenderId,
        { status: 'accepted', revision: dto.revision },
        {
          status: 'published',
          publishedAt,
          categoryCode: dto.categoryCode,
          applicationDeadline: application,
          technicalDeadline: technical,
          financialDeadline: financial,
        },
      );
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'tender.published',
          resourceType: 'tender',
          resourceId: tenderId,
          requestId,
        },
        tx,
      );
      return next;
    });
    return { status: 'published', revision, publishedAt: publishedAt.toISOString() };
  }

  // M9. Copies a cancelled tender once into a new `accepted` tender, without
  // deadlines, bids, committees, or emails (ERD, Copying a cancelled tender).
  async copy(tenderId: string): Promise<CopiedTender> {
    await this.access.managedTender(tenderId);
    const source = await this.prisma.tender.findUniqueOrThrow({
      where: { id: tenderId },
      select: {
        status: true,
        categoryCode: true,
        requestedByUserId: true,
        estimatedBalance: true,
        currencyCode: true,
        copiedInto: { select: { id: true } },
        translations: { select: { language: true, title: true, description: true } },
        scoring: {
          select: { technicalWeight: true, financialWeight: true, minimumTechnicalScore: true },
        },
        formFields: {
          select: {
            partType: true,
            inputType: true,
            position: true,
            required: true,
            unit: true,
            minimum: true,
            translations: { select: { language: true, label: true, instructions: true } },
          },
        },
        documents: {
          select: {
            kind: true,
            document: {
              select: {
                id: true,
                storageKey: true,
                originalName: true,
                mimeType: true,
                sizeBytes: true,
                language: true,
                translationOfId: true,
                uploadedByUserId: true,
              },
            },
          },
        },
      },
    });

    if (source.status !== 'cancelled') {
      throw new ApiException(HttpStatus.CONFLICT, 'TENDER_NOT_CANCELLED', 'Tender not cancelled');
    }
    if (source.copiedInto) throw alreadyCopied(source.copiedInto.id);

    // Each Terms of Reference file gets its own new storage object first.
    const copiedKeys = new Map<string, string>();
    try {
      for (const { document } of source.documents) {
        copiedKeys.set(document.id, await this.storage.copy(document.storageKey));
      }
      return await this.prisma.$transaction(async (tx) => {
        const copy = await tx.tender.create({
          data: {
            status: 'accepted',
            acceptedAt: new Date(),
            categoryCode: source.categoryCode,
            requestedByUserId: source.requestedByUserId,
            estimatedBalance: source.estimatedBalance,
            currencyCode: source.currencyCode,
            copiedFromTenderId: tenderId,
            translations: { create: source.translations },
            ...(source.scoring ? { scoring: { create: source.scoring } } : {}),
          },
          select: { id: true, status: true, revision: true },
        });

        for (const field of source.formFields) {
          await tx.tenderFormField.create({
            data: {
              tenderId: copy.id,
              partType: field.partType,
              inputType: field.inputType,
              position: field.position,
              required: field.required,
              unit: field.unit,
              minimum: field.minimum,
              translations: { create: field.translations },
            },
          });
        }

        // Originals first, so translations can point at their new originals.
        const newIds = new Map<string, string>();
        const ordered = [...source.documents].sort(
          (a, b) =>
            Number(a.document.translationOfId !== null) -
            Number(b.document.translationOfId !== null),
        );
        for (const { kind, document } of ordered) {
          const created = await tx.document.create({
            data: {
              ownerType: 'tender',
              storageKey: copiedKeys.get(document.id)!,
              originalName: document.originalName,
              mimeType: document.mimeType,
              sizeBytes: document.sizeBytes,
              language: document.language,
              uploadedByUserId: document.uploadedByUserId,
              translationOfId: document.translationOfId
                ? (newIds.get(document.translationOfId) ?? null)
                : null,
              tenderLink: { create: { tenderId: copy.id, kind } },
            },
            select: { id: true },
          });
          newIds.set(document.id, created.id);
        }

        return { ...copy, copiedFromTenderId: tenderId };
      });
    } catch (error) {
      await Promise.all([...copiedKeys.values()].map((key) => this.storage.delete(key)));
      // Two officers copying at once: the unique source key lets one win.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.tender.findUnique({
          where: { copiedFromTenderId: tenderId },
          select: { id: true },
        });
        throw alreadyCopied(existing?.id ?? null);
      }
      throw error;
    }
  }
}

function alreadyCopied(copyId: string | null): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    'TENDER_ALREADY_COPIED',
    'Tender already copied',
    undefined,
    { copyId },
  );
}
