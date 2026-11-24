import { HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AccessService } from '../auth/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/errors/api-exception.js';
import { validateBody } from '../common/errors/validate-body.js';
import { pickTranslation } from '../common/language/language.js';
import { pageMeta, type PageQueryDto } from '../common/pagination/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { officerEmailDraft, type OfficerEmailKind } from '../notifications/email-templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  TieBreakDto,
  type AwardStatus,
  type RankingPage,
  type RankingRow,
  type TieBreakResult,
  type TieCandidate,
} from './dto/award.dto.js';

type Tx = Prisma.TransactionClient;

const rankingSelect = {
  bidId: true,
  combinedScore: true,
  aboveEstimatedBalance: true,
  bid: {
    select: {
      supplier: { select: { id: true, legalName: true } },
      technicalEvaluation: { select: { technicalScore: true } },
      financialEvaluation: { select: { financialScore: true } },
    },
  },
} satisfies Prisma.BidRankingSelect;
type RankingRowData = Prisma.BidRankingGetPayload<{ select: typeof rankingSelect }>;

function toRow(r: RankingRowData, rank: number): RankingRow {
  return {
    bidId: r.bidId,
    rank,
    supplier: r.bid.supplier,
    technicalScore: r.bid.technicalEvaluation?.technicalScore ?? 0,
    financialScore: r.bid.financialEvaluation?.financialScore ?? 0,
    combinedScore: r.combinedScore.toFixed(2),
    aboveEstimatedBalance: r.aboveEstimatedBalance,
  };
}

// Highest first; equal scores share a rank (ERD, Scoring and award).
function ranked(rows: RankingRowData[]): RankingRow[] {
  const sorted = [...rows].sort((a, b) => b.combinedScore.comparedTo(a.combinedScore));
  return sorted.map((r) => {
    const higher = sorted.filter((o) => o.combinedScore.gt(r.combinedScore)).length;
    return toRow(r, higher + 1);
  });
}

// S6 Award (API_CONTRACT.md, Award). The system ranks the bids that passed
// every stage and awards a unique top score; a tie waits for the
// procurement_officer, who sees names and scores but never bid contents.
@Injectable()
export class AwardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
  ) {}

  // Called inside the evaluation transaction that completes the Financial
  // Evaluation, which holds the tender row lock.
  async rankAndAward(tx: Tx, tenderId: string): Promise<void> {
    if (await tx.bidRanking.count({ where: { tenderId } })) return;
    const tender = await tx.tender.findUniqueOrThrow({
      where: { id: tenderId },
      select: { estimatedBalance: true, scoring: true },
    });
    const weights = tender.scoring ?? { technicalWeight: 50, financialWeight: 50 };
    const bids = await tx.bid.findMany({
      where: {
        tenderId,
        technicalEvaluation: { meetsMinimum: true },
        financialEvaluation: { isNot: null },
      },
      select: {
        id: true,
        technicalEvaluation: { select: { technicalScore: true } },
        financialEvaluation: { select: { financialScore: true, confirmedTotalPrice: true } },
      },
    });
    if (!bids.length) return;
    // combined_score = (tw × ts + fw × fs) / 100: an integer over 100, so two
    // decimals are exact.
    const scored = bids.map((b) => ({
      bidId: b.id,
      total:
        weights.technicalWeight * b.technicalEvaluation!.technicalScore +
        weights.financialWeight * b.financialEvaluation!.financialScore,
      above: b.financialEvaluation!.confirmedTotalPrice.gt(tender.estimatedBalance),
    }));
    await tx.bidRanking.createMany({
      data: scored.map((s) => ({
        bidId: s.bidId,
        tenderId,
        combinedScore: (s.total / 100).toFixed(2),
        aboveEstimatedBalance: s.above,
      })),
    });
    await this.audit.record(
      {
        actorUserId: null,
        action: 'ranking.calculated',
        resourceType: 'tender',
        resourceId: tenderId,
        context: { bids: scored.length },
      },
      tx,
    );
    const top = Math.max(...scored.map((s) => s.total));
    const leaders = scored.filter((s) => s.total === top);
    // Several bids sharing the top score wait for the officer (W3).
    if (leaders.length === 1) await this.award(tx, tenderId, leaders[0].bidId, null);
  }

  private async award(tx: Tx, tenderId: string, bidId: string, tieBrokenBy: string | null) {
    const award = await tx.tenderAward.create({
      data: {
        tenderId,
        winningBidId: bidId,
        selection: tieBrokenBy ? 'tie_break' : 'top_rank',
        tieBrokenByUserId: tieBrokenBy,
      },
    });
    await tx.tender.updateMany({
      where: { id: tenderId, status: 'under_evaluation' },
      data: { status: 'awarded' },
    });
    await this.audit.record(
      {
        actorUserId: tieBrokenBy,
        action: tieBrokenBy ? 'tie.broken' : 'tender.awarded',
        resourceType: 'tender',
        resourceId: tenderId,
        context: { selection: award.selection },
      },
      tx,
    );
    if (tieBrokenBy) {
      await this.audit.record(
        {
          actorUserId: tieBrokenBy,
          action: 'tender.awarded',
          resourceType: 'tender',
          resourceId: tenderId,
        },
        tx,
      );
    }
    await this.prepareDrafts(tx, tenderId, bidId);
    return award;
  }

  // One draft per bidder, in the bidder's language when prepared (ERD, Email
  // language): winner and others after an award, or cancellation emails.
  async prepareDrafts(tx: Tx, tenderId: string, winningBidId: string | null): Promise<void> {
    const tender = await tx.tender.findUniqueOrThrow({
      where: { id: tenderId },
      select: { translations: { select: { language: true, title: true } } },
    });
    const bids = await tx.bid.findMany({
      where: { tenderId },
      select: {
        id: true,
        supplier: {
          select: {
            legalName: true,
            user: { select: { id: true, email: true, preferredLanguage: true } },
          },
        },
      },
    });
    if (!bids.length) return;
    await tx.emailMessage.createMany({
      data: bids.map((bid) => {
        const kind: OfficerEmailKind =
          winningBidId === null
            ? 'cancellation'
            : bid.id === winningBidId
              ? 'award_winner'
              : 'award_other';
        const { user, legalName } = bid.supplier;
        const title = pickTranslation(tender.translations, user.preferredLanguage).content.title;
        return {
          kind,
          tenderId,
          recipientUserId: user.id,
          recipientEmail: user.email,
          language: user.preferredLanguage,
          ...officerEmailDraft(kind, user.preferredLanguage, legalName, title),
          status: 'draft' as const,
        };
      }),
      // The partial unique index keeps one email per bidder and kind.
      skipDuplicates: true,
    });
  }

  // W1: always answers, whatever the state of the ranking.
  async status(tenderId: string): Promise<AwardStatus> {
    await this.access.managedTender(tenderId);
    const tender = await this.prisma.tender.findUniqueOrThrow({
      where: { id: tenderId },
      select: {
        status: true,
        cancellationReason: true,
        award: {
          select: {
            winningBidId: true,
            selection: true,
            awardedAt: true,
            winningBid: { select: { supplier: { select: { id: true, legalName: true } } } },
          },
        },
      },
    });
    const count = (where: Prisma.BidWhereInput) =>
      this.prisma.bid.count({ where: { tenderId, ...where } });
    const passed = { legalEvaluation: { is: { outcome: 'pass' as const } } };
    const meets = { technicalEvaluation: { is: { meetsMinimum: true } } };
    const [bids, legalDone, technicalTotal, technicalDone, financialTotal, financialDone] =
      await Promise.all([
        count({}),
        count({ legalEvaluation: { isNot: null } }),
        count(passed),
        count({ ...passed, technicalEvaluation: { isNot: null } }),
        count(meets),
        count({ ...meets, financialEvaluation: { isNot: null } }),
      ]);
    const rankings = await this.prisma.bidRanking.findMany({
      where: { tenderId },
      select: rankingSelect,
    });
    const rows = ranked(rankings);
    const tied = !tender.award && rows.filter((r) => r.rank === 1).length > 1;
    const candidates: TieCandidate[] = tied
      ? rows
          .filter((r) => r.rank === 1)
          .map(({ bidId, supplier, technicalScore, financialScore, combinedScore }) => ({
            bidId,
            supplier,
            technicalScore,
            financialScore,
            combinedScore,
          }))
      : [];
    return {
      tenderId,
      tenderStatus: tender.status,
      awardStatus: tender.award
        ? 'awarded'
        : tender.status === 'cancelled'
          ? 'cancelled'
          : tied
            ? 'tie_break_required'
            : 'in_progress',
      cancellationReason: tender.cancellationReason,
      progress: {
        legal: { done: legalDone, total: bids },
        technical: { done: technicalDone, total: technicalTotal },
        financial: { done: financialDone, total: financialTotal },
      },
      award: tender.award
        ? {
            bidId: tender.award.winningBidId,
            supplier: tender.award.winningBid.supplier,
            selection: tender.award.selection,
            awardedAt: tender.award.awardedAt.toISOString(),
          }
        : null,
      tieBreakCandidates: candidates,
    };
  }

  // W2: names and scores only, never bid parts, prices or bidder codes.
  async ranking(tenderId: string, query: PageQueryDto): Promise<RankingPage> {
    await this.access.managedTender(tenderId);
    const rankings = await this.prisma.bidRanking.findMany({
      where: { tenderId },
      select: rankingSelect,
    });
    const rows = ranked(rankings);
    const start = (query.page - 1) * query.limit;
    return { data: rows.slice(start, start + query.limit), meta: pageMeta(query, rows.length) };
  }

  // W3: the officer chooses among the bids tied at the top.
  async breakTie(
    userId: string,
    tenderId: string,
    body: unknown,
    key: string | undefined,
  ): Promise<{ body: TieBreakResult; replayed: boolean }> {
    await this.access.managedTender(tenderId);
    const route = `POST /api/v1/manage/tenders/${tenderId}/award`;
    const hash = createHash('sha256')
      .update(JSON.stringify(body ?? {}))
      .digest('hex');
    const result = await this.idempotency.user(
      userId,
      key,
      route,
      hash,
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM tenders WHERE id = ${tenderId}::uuid FOR UPDATE`;
        if (await tx.tenderAward.findUnique({ where: { tenderId } })) {
          throw new ApiException(HttpStatus.CONFLICT, 'ALREADY_AWARDED', 'Already awarded');
        }
        const rankings = await tx.bidRanking.findMany({
          where: { tenderId },
          select: rankingSelect,
        });
        const leaders = ranked(rankings).filter((r) => r.rank === 1);
        if (leaders.length < 2) {
          throw new ApiException(HttpStatus.CONFLICT, 'TIE_BREAK_NOT_REQUIRED', 'No tie to break');
        }
        const dto = await validateBody(TieBreakDto, body);
        if (!leaders.some((l) => l.bidId === dto.bidId)) {
          throw new ApiException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'BID_NOT_TIE_CANDIDATE',
            'Not a tied bid',
          );
        }
        const award = await this.award(tx, tenderId, dto.bidId, userId);
        return {
          tenderStatus: 'awarded',
          award: {
            bidId: award.winningBidId,
            selection: award.selection,
            awardedAt: award.awardedAt.toISOString(),
          },
        };
      },
      200,
    );
    return { body: result.body as unknown as TieBreakResult, replayed: result.replayed };
  }
}
