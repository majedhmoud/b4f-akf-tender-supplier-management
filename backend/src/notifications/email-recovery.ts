import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailQueue } from './email-queue.js';

// Queues every `sending` email that has no job: the enqueue after commit
// failed, or Redis lost its data. Runs at start-up and then every minute.
// A job kept after an uncertain delivery blocks a blind resend (ERD, Emails).
@Injectable()
export class EmailRecovery implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(EmailRecovery.name);
  private readonly intervalMs: number;
  private timer?: NodeJS.Timeout;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly queue: EmailQueue,
  ) {
    // 0 turns the timer off; tests call sweep() themselves.
    this.intervalMs = Number(config.get('EMAIL_RECOVERY_INTERVAL_MS', 60_000));
  }

  onApplicationBootstrap(): void {
    if (this.intervalMs <= 0) return;
    const run = () => void this.sweep().catch((e: Error) => this.logger.warn(e.message));
    run();
    this.timer = setInterval(run, this.intervalMs);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  // Returns how many emails it queued.
  async sweep(where: { id?: { in: string[] } } = {}): Promise<number> {
    const sending = await this.prisma.emailMessage.findMany({
      where: { ...where, status: 'sending' },
      select: { id: true, revision: true },
      orderBy: { preparedAt: 'asc' },
      take: 500,
    });
    let queued = 0;
    for (const { id, revision } of sending) {
      if (await this.queue.hasJob(id, revision)) continue;
      if (await this.queue.enqueue(id, revision)) queued += 1;
    }
    return queued;
  }

  // A retry after a confirmed failure: `failed` → `sending`, clearing the
  // failure, then the same revision is delivered again (ERD, Emails).
  async retry(messageId: string): Promise<boolean> {
    const message = await this.prisma.emailMessage.findUnique({
      where: { id: messageId },
      select: { revision: true },
    });
    if (!message) return false;
    const claimed = await this.prisma.emailMessage.updateMany({
      where: { id: messageId, revision: message.revision, status: 'failed' },
      data: { status: 'sending', failureCode: null, failedAt: null },
    });
    if (claimed.count !== 1) return false;
    await this.queue.forget(messageId, message.revision);
    await this.queue.enqueue(messageId, message.revision);
    return true;
  }
}
