import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

export const EMAIL_QUEUE = 'email';
// How long a request waits for Redis before leaving the job to recovery.
const ENQUEUE_TIMEOUT_MS = 2_000;

export interface EmailJob {
  messageId: string;
  revision: number;
}

// One delivery is one message revision (ERD, Emails), so a second enqueue of
// the same revision adds nothing.
export function emailJobId(messageId: string, revision: number): string {
  return `email-${messageId}-${revision}`;
}

// Schedules delivery after the email row is committed. Redis being down never
// fails the request: the row stays `sending` and EmailRecovery enqueues it later.
@Injectable()
export class EmailQueue {
  private readonly logger = new Logger(EmailQueue.name);
  private readonly attempts: number;
  private readonly backoffMs: number;

  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<EmailJob>,
    config: ConfigService,
  ) {
    this.attempts = Number(config.get('EMAIL_ATTEMPTS', 5));
    this.backoffMs = Number(config.get('EMAIL_BACKOFF_MS', 2_000));
  }

  async enqueue(messageId: string, revision: number): Promise<boolean> {
    const add = this.queue.add(
      'deliver',
      { messageId, revision },
      {
        jobId: emailJobId(messageId, revision),
        attempts: this.attempts,
        backoff: { type: 'exponential', delay: this.backoffMs },
        removeOnComplete: true,
        // Kept, so recovery does not resend a delivery whose outcome is uncertain.
        removeOnFail: false,
      },
    );
    try {
      await Promise.race([
        add,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timed out')), ENQUEUE_TIMEOUT_MS).unref(),
        ),
      ]);
      return true;
    } catch (error) {
      add.catch(() => undefined);
      this.logger.warn(`Email ${messageId} not queued yet: ${(error as Error).message}`);
      return false;
    }
  }

  async hasJob(messageId: string, revision: number): Promise<boolean> {
    return (await this.queue.getJob(emailJobId(messageId, revision))) !== undefined;
  }

  // Drops a finished job, so a retry of the same revision can be queued again.
  async forget(messageId: string, revision: number): Promise<void> {
    await this.queue.remove(emailJobId(messageId, revision));
  }
}
