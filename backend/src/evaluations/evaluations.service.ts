import { HttpStatus, Injectable } from '@nestjs/common';
import { notFound } from '../auth/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AwardsService } from '../awards/awards.service.js';
import { ApiException } from '../common/errors/api-exception.js';
import { validateBody } from '../common/errors/validate-body.js';
import { pickTranslation } from '../common/language/language.js';
import { pageArgs, pageMeta, type PageQueryDto } from '../common/pagination/pagination.js';
import type {
  CommitteeType,
  Language,
  PartType,
  Prisma,
  TenderStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SignedUrlService } from '../storage/signed-url.service.js';
import { statusChanged } from '../tenders/tender-rules.js';
import {
  FinancialEvaluationDto,
  LegalEvaluationDto,
  TechnicalEvaluationDto,
  type BlindQueuePage,
  type EvaluationAnswer,
  type EvaluationDocument,
  type FinancialBidView,
  type FinancialEvaluationView,
  type LegalBidView,
  type LegalEvaluationView,
  type LegalQueuePage,
  type TechnicalBidView,
  type TechnicalEvaluationView,
} from './dto/evaluation.dto.js';

export type Stage = 'legal' | 'technical' | 'financial';
const COMMITTEE: Record<Stage, CommitteeType> = {
  legal: 'legal_committee',
  technical: 'technical_committee',
  financial: 'financial_committee',
};
const PART: Record<Stage, PartType> = {
  legal: 'legal_information',
  technical: 'technical_offer',
  financial: 'financial_offer',
};
// Neutral download names for blind stages (API_CONTRACT.md, Evaluation).
const NEUTRAL: Record<Exclude<Stage, 'legal'>, string> = {
  technical: 'Technical offer',
  financial: 'Financial offer',
};
// Queues and views open from under_evaluation; submissions need it.
const VIEWABLE: TenderStatus[] = ['under_evaluation', 'awarded', 'cancelled'];

// The bids a stage may see: legal sees all, technical those that passed
// Legal Evaluation, financial those that met the minimum technical score
// (ERD, Sealed, blind evaluation).
function eligible(tenderId: string, stage: Stage): Prisma.BidWhereInput {
  if (stage === 'legal') return { tenderId };
  if (stage === 'technical') return { tenderId, legalEvaluation: { outcome: 'pass' } };
  return { tenderId, technicalEvaluation: { meetsMinimum: true } };
}

function alreadySubmitted(evaluation: unknown): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    'ALREADY_SUBMITTED',
    'Already evaluated',
    undefined,
    {
      evaluation,
    },
  );
}

const partSelect = {
  documents: {
    select: {
      kind: true,
      document: { select: { id: true, originalName: true, language: true, uploadedAt: true } },
    },
    orderBy: { document: { uploadedAt: 'asc' } },
  },
  answers: {
    where: { documentId: null },
    select: {
      fieldId: true,
      scalarValue: true,
      field: {
        select: {
          position: true,
          translations: { select: { language: true, label: true, instructions: true } },
        },
      },
    },
  },
} satisfies Prisma.BidPartSelect;
type PartRow = Prisma.BidPartGetPayload<{ select: typeof partSelect }>;

function legalView(e: { outcome: 'pass' | 'fail'; reason: string | null; submittedAt: Date }) {
  return { outcome: e.outcome, reason: e.reason, submittedAt: e.submittedAt.toISOString() };
}
function technicalView(e: {
  technicalScore: number;
  comments: string | null;
  submittedAt: Date;
}): TechnicalEvaluationView {
  return {
    technicalScore: e.technicalScore,
    comments: e.comments,
    submittedAt: e.submittedAt.toISOString(),
  };
}
function financialView(e: {
  financialScore: number;
  confirmedTotalPrice: Prisma.Decimal;
  comments: string | null;
  submittedAt: Date;
}): FinancialEvaluationView {
  return {
    financialScore: e.financialScore,
    confirmedTotalPrice: e.confirmedTotalPrice.toFixed(2),
    comments: e.comments,
    submittedAt: e.submittedAt.toISOString(),
  };
}

// S5 Sealed Evaluation (API_CONTRACT.md L1–L4, X1–X4, F1–F4). One rule decides
// every list, count, detail, submission and download: an approved assignment
// of the stage's committee type on that tender, plus the bid's eligibility for
// that stage. Anything else is 404.
@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly signedUrls: SignedUrlService,
    private readonly awards: AwardsService,
  ) {}

  private async assignment(
    tx: Prisma.TransactionClient | PrismaService,
    userId: string,
    tenderId: string,
    stage: Stage,
  ) {
    const row = await tx.committeeAssignment.findFirst({
      where: { userId, tenderId, status: 'approved', committee: { type: COMMITTEE[stage] } },
      select: { id: true },
    });
    if (!row) throw notFound();
    return row.id;
  }

  // The tender, once the assignment is confirmed, in a viewable status.
  private async viewableTender(userId: string, tenderId: string, stage: Stage) {
    await this.assignment(this.prisma, userId, tenderId, stage);
    const tender = await this.prisma.tender.findUniqueOrThrow({
      where: { id: tenderId },
      select: { status: true, currencyCode: true },
    });
    if (!VIEWABLE.includes(tender.status)) throw statusChanged(tender.status);
    return tender;
  }

  // A bid this stage may see, by bid ID (legal) or bidder code (blind stages).
  private async findBid(tenderId: string, stage: Stage, ref: string) {
    const where: Prisma.BidWhereInput = {
      ...eligible(tenderId, stage),
      ...(stage === 'legal' ? { id: ref } : { bidderCode: ref }),
    };
    const bid = await this.prisma.bid.findFirst({ where, select: { id: true, bidderCode: true } });
    if (!bid) throw notFound();
    return bid;
  }

  private async part(bidId: string, stage: Stage): Promise<PartRow> {
    return this.prisma.bidPart.findUniqueOrThrow({
      where: { bidId_partType: { bidId, partType: PART[stage] } },
      select: partSelect,
    });
  }

  private documents(part: PartRow, stage: Stage, bidderCode: string): EvaluationDocument[] {
    return part.documents.map((d, i) => {
      const ext = d.document.originalName.includes('.')
        ? `.${d.document.originalName.split('.').pop()}`
        : '';
      return {
        id: d.document.id,
        kind: d.kind,
        name:
          stage === 'legal'
            ? d.document.originalName
            : `${NEUTRAL[stage]} – ${bidderCode} – ${i + 1}${ext}`,
        language: d.document.language,
        translations: [],
      };
    });
  }

  private answers(part: PartRow, language: Language): EvaluationAnswer[] {
    return [...part.answers]
      .sort((a, b) => a.field.position - b.field.position)
      .map((a) => ({
        fieldId: a.fieldId,
        label: pickTranslation(a.field.translations, language).content.label,
        value: a.scalarValue as string | number | boolean | null,
      }));
  }

  private canSubmit(status: TenderStatus, evaluated: boolean): 'submit'[] {
    return status === 'under_evaluation' && !evaluated ? ['submit'] : [];
  }

  // L1, X1, F1.
  async queue(
    userId: string,
    tenderId: string,
    stage: Stage,
    query: PageQueryDto,
  ): Promise<LegalQueuePage | BlindQueuePage> {
    await this.viewableTender(userId, tenderId, stage);
    const where = eligible(tenderId, stage);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.bid.findMany({
        where,
        ...pageArgs(query),
        orderBy:
          stage === 'legal' ? [{ submittedAt: 'asc' }, { id: 'asc' }] : [{ bidderCode: 'asc' }],
        select: {
          id: true,
          bidderCode: true,
          supplier: { select: { legalName: true } },
          legalEvaluation: { select: { bidId: true } },
          technicalEvaluation: { select: { bidId: true } },
          financialEvaluation: { select: { bidId: true } },
        },
      }),
      this.prisma.bid.count({ where }),
    ]);
    const done = (row: (typeof rows)[number]) =>
      !!(stage === 'legal'
        ? row.legalEvaluation
        : stage === 'technical'
          ? row.technicalEvaluation
          : row.financialEvaluation);
    const meta = pageMeta(query, total);
    if (stage === 'legal')
      return {
        data: rows.map((r) => ({
          bidId: r.id,
          supplier: { legalName: r.supplier.legalName },
          evaluated: done(r),
        })),
        meta,
      };
    return { data: rows.map((r) => ({ bidderCode: r.bidderCode, evaluated: done(r) })), meta };
  }

  // L2.
  async legalDetail(
    userId: string,
    tenderId: string,
    bidId: string,
    language: Language,
  ): Promise<LegalBidView> {
    const tender = await this.viewableTender(userId, tenderId, 'legal');
    const bid = await this.findBid(tenderId, 'legal', bidId);
    const row = await this.prisma.bid.findUniqueOrThrow({
      where: { id: bid.id },
      select: {
        supplier: { select: { id: true, legalName: true, registrationNumber: true } },
        legalEvaluation: true,
        parts: { where: { partType: 'legal_information' }, select: { standardAnswers: true } },
      },
    });
    const part = await this.part(bid.id, 'legal');
    const standard = row.parts[0]?.standardAnswers;
    return {
      bidId: bid.id,
      supplier: row.supplier,
      legalInformation: (standard && typeof standard === 'object' && !Array.isArray(standard)
        ? standard
        : {}) as Record<string, string>,
      documents: this.documents(part, 'legal', bid.bidderCode),
      answers: this.answers(part, language),
      evaluation: row.legalEvaluation ? legalView(row.legalEvaluation) : null,
      allowedActions: this.canSubmit(tender.status, !!row.legalEvaluation),
    };
  }

  // X2 and F2: no bid ID, supplier identity or original file names.
  async blindDetail(
    userId: string,
    tenderId: string,
    stage: 'technical' | 'financial',
    bidderCode: string,
    language: Language,
  ): Promise<TechnicalBidView | FinancialBidView> {
    const tender = await this.viewableTender(userId, tenderId, stage);
    const bid = await this.findBid(tenderId, stage, bidderCode);
    const part = await this.part(bid.id, stage);
    const base = {
      bidderCode: bid.bidderCode,
      documents: this.documents(part, stage, bid.bidderCode),
      answers: this.answers(part, language),
    };
    if (stage === 'technical') {
      const e = await this.prisma.technicalEvaluation.findUnique({ where: { bidId: bid.id } });
      return {
        ...base,
        evaluation: e ? technicalView(e) : null,
        allowedActions: this.canSubmit(tender.status, !!e),
      };
    }
    const e = await this.prisma.financialEvaluation.findUnique({ where: { bidId: bid.id } });
    return {
      ...base,
      tenderCurrency: tender.currencyCode,
      evaluation: e ? financialView(e) : null,
      allowedActions: this.canSubmit(tender.status, !!e),
    };
  }

  // L4, X4, F4: only files of this stage's part, under neutral names when blind.
  async download(userId: string, tenderId: string, stage: Stage, ref: string, docId: string) {
    await this.viewableTender(userId, tenderId, stage);
    const bid = await this.findBid(tenderId, stage, ref);
    const part = await this.part(bid.id, stage);
    const doc = this.documents(part, stage, bid.bidderCode).find((d) => d.id === docId);
    if (!doc) throw notFound();
    const file = await this.prisma.document.findUniqueOrThrow({
      where: { id: docId },
      select: { storageKey: true },
    });
    return this.signedUrls.sign(file.storageKey, doc.name);
  }

  // L3, X3, F3. The tender row lock serializes the last evaluations of a
  // stage, so the completion check sees every committed row.
  async submit(
    userId: string,
    tenderId: string,
    stage: Stage,
    ref: string,
    body: unknown,
    requestId?: string,
  ): Promise<LegalEvaluationView | TechnicalEvaluationView | FinancialEvaluationView> {
    await this.assignment(this.prisma, userId, tenderId, stage);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tenders WHERE id = ${tenderId}::uuid FOR UPDATE`;
      const assignmentId = await this.assignment(tx, userId, tenderId, stage);
      const bid = await tx.bid.findFirst({
        where: {
          ...eligible(tenderId, stage),
          ...(stage === 'legal' ? { id: ref } : { bidderCode: ref }),
        },
        select: {
          id: true,
          legalEvaluation: true,
          technicalEvaluation: true,
          financialEvaluation: true,
        },
      });
      if (!bid) throw notFound();
      const tender = await tx.tender.findUniqueOrThrow({
        where: { id: tenderId },
        select: { status: true, scoring: { select: { minimumTechnicalScore: true } } },
      });
      if (tender.status !== 'under_evaluation') throw statusChanged(tender.status);

      let saved: LegalEvaluationView | TechnicalEvaluationView | FinancialEvaluationView;
      if (stage === 'legal') {
        if (bid.legalEvaluation) throw alreadySubmitted(legalView(bid.legalEvaluation));
        const dto = await validateBody(LegalEvaluationDto, body);
        const reason = dto.reason?.trim() || null;
        if (dto.outcome === 'fail' && !reason) {
          throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Reason needed', [
            { field: 'reason', code: 'REQUIRED' },
          ]);
        }
        const row = await tx.legalEvaluation.create({
          data: { bidId: bid.id, assignmentId, outcome: dto.outcome, reason },
        });
        saved = legalView(row);
      } else if (stage === 'technical') {
        if (bid.technicalEvaluation) throw alreadySubmitted(technicalView(bid.technicalEvaluation));
        const dto = await validateBody(TechnicalEvaluationDto, body);
        const row = await tx.technicalEvaluation.create({
          data: {
            bidId: bid.id,
            assignmentId,
            technicalScore: dto.technicalScore,
            // Bids below the minimum technical score fail (WORKFLOWS.md).
            meetsMinimum: dto.technicalScore >= (tender.scoring?.minimumTechnicalScore ?? 0),
            comments: dto.comments || null,
          },
        });
        saved = technicalView(row);
      } else {
        if (bid.financialEvaluation) throw alreadySubmitted(financialView(bid.financialEvaluation));
        const dto = await validateBody(FinancialEvaluationDto, body);
        const row = await tx.financialEvaluation.create({
          data: {
            bidId: bid.id,
            assignmentId,
            financialScore: dto.financialScore,
            confirmedTotalPrice: dto.confirmedTotalPrice,
            comments: dto.comments || null,
          },
        });
        saved = financialView(row);
      }

      // Who and when only; scores and reasons stay out of the audit log.
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'evaluation.submitted',
          resourceType: 'bid',
          resourceId: bid.id,
          context: { stage },
          requestId,
        },
        tx,
      );
      await this.cancelIfNoQualifiedBid(tx, tenderId);
      return saved;
    });
  }

  // A stage completes when the stage before it is complete and every bid
  // eligible for it is evaluated. A complete stage leaving no eligible bid
  // cancels the tender (ERD, Lifecycle jobs). Ranking after the financial
  // stage belongs to S6.
  private async cancelIfNoQualifiedBid(tx: Prisma.TransactionClient, tenderId: string) {
    const count = (where: Prisma.BidWhereInput) => tx.bid.count({ where });
    const bids = await count({ tenderId });
    const legalDone = (await count({ tenderId, legalEvaluation: { isNot: null } })) === bids;
    if (!legalDone) return;
    const passed = await count(eligible(tenderId, 'technical'));
    let noneLeft = passed === 0;
    if (!noneLeft) {
      const technicalDone =
        (await count({
          ...eligible(tenderId, 'technical'),
          technicalEvaluation: { isNot: null },
        })) === passed;
      if (!technicalDone) return;
      const meets = await count(eligible(tenderId, 'financial'));
      noneLeft = meets === 0;
      if (!noneLeft) {
        const financialDone =
          (await count({
            ...eligible(tenderId, 'financial'),
            financialEvaluation: { isNot: null },
          })) === meets;
        // A complete Financial Evaluation is ranked, and a unique top score is
        // awarded, in this same transaction (ERD, Scoring and award; S6).
        if (financialDone) await this.awards.rankAndAward(tx, tenderId);
        return;
      }
    }
    const cancelled = await tx.tender.updateMany({
      where: { id: tenderId, status: 'under_evaluation' },
      data: {
        status: 'cancelled',
        cancellationReason: 'no_qualified_bid',
        cancelledAt: new Date(),
      },
    });
    // Every bidder gets a cancellation draft for the officer to review.
    if (cancelled.count === 1) await this.awards.prepareDrafts(tx, tenderId, null);
  }

  // C7 counts: bids this assignment may still evaluate.
  async pendingFor(tenderId: string, type: CommitteeType): Promise<number> {
    const stage = (Object.keys(COMMITTEE) as Stage[]).find((s) => COMMITTEE[s] === type)!;
    const relation =
      stage === 'legal'
        ? { legalEvaluation: { is: null } }
        : stage === 'technical'
          ? { technicalEvaluation: { is: null } }
          : { financialEvaluation: { is: null } };
    return this.prisma.bid.count({ where: { ...eligible(tenderId, stage), ...relation } });
  }
}
