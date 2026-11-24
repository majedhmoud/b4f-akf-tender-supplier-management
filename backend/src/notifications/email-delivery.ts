import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnrecoverableError, type Job } from 'bullmq';
import { createTransport, type Transporter } from 'nodemailer';
import { SetupTokens } from '../account-setup/setup-tokens.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SETUP_LINK_PLACEHOLDER } from './email-templates.js';
import { EMAIL_QUEUE, type EmailJob } from './email-queue.js';

// The API's failure code for a confirmed non-delivery (API_CONTRACT.md, Emails).
export const DELIVERY_FAILED = 'DELIVERY_FAILED';

// Errors raised before any message data was handed to the server.
const BEFORE_SENDING = new Set(['EDNS', 'EAUTH', 'EENVELOPE', 'EMESSAGE']);
const NO_CONNECTION = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH']);
const CONNECT_WAITS = new Set(['CONNECT_TIMEOUT', 'GREETING_TIMEOUT', 'UPGRADE_TIMEOUT']);

type Outcome = 'retry' | 'failed' | 'uncertain';

// The fields Nodemailer sets on a send error that tell what happened.
interface SendError {
  code?: string;
  responseCode?: number;
  permanent?: boolean;
  originalCode?: string;
  timeoutType?: string;
}

// Sorts a send error by what it proves (ERD, Emails). An SMTP reply refusing
// the message, or a connection that never opened, is a confirmed
// non-delivery: permanent replies are final, the rest are retried. Anything
// else, such as a socket dropped mid-send, leaves it unknown whether the
// server accepted the message.
export function classify(error: unknown): Outcome {
  const { code, responseCode, permanent, originalCode, timeoutType } = error as SendError;
  if (typeof responseCode === 'number') return permanent ? 'failed' : 'retry';
  if (code && BEFORE_SENDING.has(code)) return 'retry';
  if (originalCode && NO_CONNECTION.has(originalCode)) return 'retry';
  if (timeoutType && CONNECT_WAITS.has(timeoutType)) return 'retry';
  return 'uncertain';
}

// Delivers queued emails through SMTP (Mailpit locally, ADR 0004). Each
// delivery is identified by message ID and revision, also in the Message-ID
// header, so a recovered resend can be recognised as the same message.
@Injectable()
@Processor(EMAIL_QUEUE)
export class EmailDelivery extends WorkerHost {
  private readonly logger = new Logger(EmailDelivery.name);
  private readonly transport: Transporter;
  private readonly from: string;
  private readonly idDomain: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokens: SetupTokens,
    private readonly audit: AuditService,
  ) {
    super();
    this.transport = createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port: Number(config.get('SMTP_PORT', 1025)),
      secure: false,
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
    this.from = config.get<string>('MAIL_FROM', 'AKF Tenders <no-reply@akf-tenders.test>');
    this.idDomain = /@([^>\s]+)/.exec(this.from)?.[1] ?? 'akf-tenders.test';
  }

  async process(job: Job<EmailJob>): Promise<void> {
    const { messageId, revision } = job.data;
    const message = await this.prisma.emailMessage.findUnique({ where: { id: messageId } });
    // Another revision or a finished delivery: nothing to send for this job.
    if (!message || message.status !== 'sending' || message.revision !== revision) return;

    let body = message.body;
    if (message.kind === 'account_setup') {
      const link = await this.tokens.currentLink(message.recipientUserId, message.language);
      if (!link) {
        // Nothing went out; the holder asks for a new link (S3).
        await this.markFailed(messageId, revision);
        return;
      }
      body = body.replace(SETUP_LINK_PLACEHOLDER, link);
    }

    try {
      await this.transport.sendMail({
        from: this.from,
        to: message.recipientEmail,
        subject: message.subject,
        text: body,
        messageId: `<email-${messageId}-${revision}@${this.idDomain}>`,
      });
    } catch (error) {
      const outcome = classify(error);
      const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      const reason = (error as { code?: string }).code ?? 'SMTP error';
      this.logger.warn(
        `Email ${messageId} attempt ${job.attemptsMade + 1}: ${outcome} (${reason})`,
      );
      if (outcome === 'failed' || (outcome === 'retry' && lastAttempt)) {
        await this.markFailed(messageId, revision);
        throw new UnrecoverableError(reason);
      }
      // Uncertain or retryable: BullMQ retries with the same Message-ID. An
      // uncertain one stays `sending` even after the last attempt.
      throw error;
    }

    await this.prisma.$transaction(async (tx) => {
      const sent = await tx.emailMessage.updateMany({
        where: { id: messageId, revision, status: 'sending' },
        data: { status: 'sent', sentAt: new Date() },
      });
      if (sent.count === 1 && message.kind === 'account_setup') {
        await this.audit.record(
          {
            actorUserId: null,
            action: 'account_setup_link.sent',
            resourceType: 'user_account',
            resourceId: message.recipientUserId,
            context: { emailMessageId: messageId, language: message.language },
          },
          tx,
        );
      }
    });
  }

  private async markFailed(messageId: string, revision: number): Promise<void> {
    await this.prisma.emailMessage.updateMany({
      where: { id: messageId, revision, status: 'sending' },
      data: { status: 'failed', failureCode: DELIVERY_FAILED, failedAt: new Date() },
    });
  }
}
