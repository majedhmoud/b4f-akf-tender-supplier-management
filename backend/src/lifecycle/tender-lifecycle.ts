import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const LIFECYCLE_QUEUE = 'tender-lifecycle';

// The automatic deadline transitions (WORKFLOWS.md, tender statuses; ERD,
// Lifecycle jobs). Every change applies only from the expected status, so a
// retried or doubled run does nothing. The application-deadline step locks
// the tender row, as bid submission does, so a last-second bid is never missed.
@Injectable()
export class TenderLifecycle {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async sweep(now = new Date()): Promise<void> {
    const due = await this.prisma.tender.findMany({
      where: { status: 'published', applicationDeadline: { lte: now } },
      select: { id: true },
    });
    for (const { id } of due) await this.closeApplications(id, now);
    const evaluating = await this.prisma.tender.findMany({
      where: { status: 'closed', financialDeadline: { lte: now } },
      select: { id: true },
    });
    for (const { id } of evaluating) await this.startEvaluation(id, now);
  }

  // published → closed with bids, or → cancelled (no_bids) without.
  private async closeApplications(tenderId: string, now: Date) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tenders WHERE id = ${tenderId}::uuid FOR UPDATE`;
      const tender = await tx.tender.findUniqueOrThrow({
        where: { id: tenderId },
        select: { status: true, applicationDeadline: true, _count: { select: { bids: true } } },
      });
      if (tender.status !== 'published' || !tender.applicationDeadline) return;
      if (tender.applicationDeadline > now) return;
      if (tender._count.bids === 0) {
        await tx.tender.update({
          where: { id: tenderId },
          data: { status: 'cancelled', cancellationReason: 'no_bids', cancelledAt: now },
        });
        return;
      }
      await tx.tender.update({ where: { id: tenderId }, data: { status: 'closed' } });
      await this.audit.record(
        {
          actorUserId: null,
          action: 'tender.closed',
          resourceType: 'tender',
          resourceId: tenderId,
        },
        tx,
      );
    });
  }

  // closed → under_evaluation at the financial deadline.
  private async startEvaluation(tenderId: string, now: Date) {
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.tender.updateMany({
        where: { id: tenderId, status: 'closed', financialDeadline: { lte: now } },
        data: { status: 'under_evaluation' },
      });
      if (moved.count !== 1) return;
      await this.audit.record(
        {
          actorUserId: null,
          action: 'tender.under_evaluation',
          resourceType: 'tender',
          resourceId: tenderId,
        },
        tx,
      );
    });
  }
}

// Runs the sweep once a minute through a BullMQ job scheduler (ADR 0004), and
// once at start-up. LIFECYCLE_INTERVAL_MS=0 turns the schedule off.
@Injectable()
@Processor(LIFECYCLE_QUEUE)
export class TenderLifecycleWorker extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(TenderLifecycleWorker.name);
  private readonly intervalMs: number;

  constructor(
    config: ConfigService,
    @InjectQueue(LIFECYCLE_QUEUE) private readonly queue: Queue,
    private readonly lifecycle: TenderLifecycle,
  ) {
    super();
    this.intervalMs = Number(config.get('LIFECYCLE_INTERVAL_MS', 60_000));
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.intervalMs <= 0) return;
    await this.lifecycle.sweep().catch((e: Error) => this.logger.warn(e.message));
    await this.queue
      .upsertJobScheduler(
        'tender-deadlines',
        { every: this.intervalMs },
        { name: 'sweep', opts: { removeOnComplete: true, removeOnFail: 50 } },
      )
      .catch((e: Error) => this.logger.warn(`Deadline schedule not set: ${e.message}`));
  }

  async process(): Promise<void> {
    await this.lifecycle.sweep();
  }
}
