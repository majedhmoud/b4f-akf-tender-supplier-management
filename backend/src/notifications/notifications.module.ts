import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SetupTokensModule } from '../account-setup/setup-tokens.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { EmailDelivery } from './email-delivery.js';
import { EMAIL_QUEUE, EmailQueue } from './email-queue.js';
import { EmailRecovery } from './email-recovery.js';

// Automatic email delivery: a BullMQ queue on Redis and an SMTP worker
// (ADR 0004). Emails are rows first; the queue only schedules their delivery.
@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE }), SetupTokensModule, AuditModule],
  providers: [EmailQueue, EmailDelivery, EmailRecovery],
  exports: [EmailQueue, EmailRecovery],
})
export class NotificationsModule {}
