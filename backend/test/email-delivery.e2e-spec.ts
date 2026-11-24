import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { SetupTokens } from '../src/account-setup/setup-tokens.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { EmailQueue } from '../src/notifications/email-queue.js';
import { EmailRecovery } from '../src/notifications/email-recovery.js';
import { accountSetupEmail } from '../src/notifications/email-templates.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FakeSmtp } from './support/fake-smtp.js';
import { uniqueRunId } from './support/run-id.js';

// Delivery outcomes the happy path cannot show (ERD, Emails): a confirmed
// refusal becomes `failed`, an uncertain one stays `sending` and is not
// resent blindly, and a retry delivers the same message again. The worker
// in this file talks to a fake SMTP server; its queue prefix is its own.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
process.env.EMAIL_ATTEMPTS = '2';
process.env.EMAIL_BACKOFF_MS = '50';

describe('Email delivery outcomes (e2e)', () => {
  const smtp = new FakeSmtp();
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let queue: EmailQueue;
  let recovery: EmailRecovery;
  const domain = `@delivery-${uniqueRunId()}.test`;
  let number = 0;

  // What U7 commits: a pending account, its link, and a `sending` email.
  async function committedEmail() {
    number += 1;
    const email = `supplier-${number}${domain}`;
    const user = await prisma.userAccount.create({
      data: { email, displayName: 'Supplier', preferredLanguage: 'en', status: 'pending_setup' },
    });
    const tokens = app.get(SetupTokens);
    return prisma.$transaction(async (tx) => {
      await tokens.issue(tx, user.id);
      return tx.emailMessage.create({
        data: {
          kind: 'account_setup',
          recipientUserId: user.id,
          recipientEmail: email,
          language: 'en',
          ...accountSetupEmail('en', 'Supplier'),
          status: 'sending',
        },
      });
    });
  }

  const row = (id: string) => prisma.emailMessage.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    process.env.SMTP_PORT = String(await smtp.listen());
    process.env.SMTP_HOST = '127.0.0.1';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    queue = app.get(EmailQueue);
    recovery = app.get(EmailRecovery);
  });

  afterAll(async () => {
    const users = await prisma.userAccount.findMany({
      where: { email: { endsWith: domain } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.auditEvent.deleteMany({ where: { resourceId: { in: ids } } });
    await prisma.emailMessage.deleteMany({ where: { recipientUserId: { in: ids } } });
    await prisma.userAccount.deleteMany({ where: { id: { in: ids } } });
    await app.close();
    await smtp.close();
  });

  it('records a temporary refusal as failed once the retries run out', async () => {
    smtp.mode = 'busy';
    const message = await committedEmail();
    const before = smtp.connections;
    await queue.enqueue(message.id, message.revision);

    await expect.poll(async () => (await row(message.id)).status).toBe('failed');
    const failed = await row(message.id);
    expect(failed.failureCode).toBe('DELIVERY_FAILED');
    expect(failed.failedAt).not.toBeNull();
    expect(failed.sentAt).toBeNull();
    expect(smtp.connections - before).toBe(2);
  });

  it('records a permanent refusal as failed without retrying', async () => {
    smtp.mode = 'reject';
    const message = await committedEmail();
    const before = smtp.connections;
    await queue.enqueue(message.id, message.revision);

    await expect.poll(async () => (await row(message.id)).status).toBe('failed');
    expect(smtp.connections - before).toBe(1);
  });

  it('keeps an uncertain delivery at sending, and recovery does not resend it', async () => {
    smtp.mode = 'drop';
    const message = await committedEmail();
    const before = smtp.connections;
    await queue.enqueue(message.id, message.revision);

    // Both attempts reach the end of the message, then lose the reply.
    await expect.poll(() => smtp.connections - before).toBe(2);
    await new Promise((r) => setTimeout(r, 500));
    const kept = await row(message.id);
    expect(kept.status).toBe('sending');
    expect(kept.failureCode).toBeNull();

    expect(await recovery.sweep({ id: { in: [message.id] } })).toBe(0);
    await new Promise((r) => setTimeout(r, 300));
    expect(smtp.connections - before).toBe(2);
  });

  it('retries a failed email: clears the failure and sends the same delivery identity', async () => {
    smtp.mode = 'reject';
    const message = await committedEmail();
    await queue.enqueue(message.id, message.revision);
    await expect.poll(async () => (await row(message.id)).status).toBe('failed');

    smtp.mode = 'accept';
    expect(await recovery.retry(message.id)).toBe(true);
    const claimed = await row(message.id);
    expect(claimed.failureCode).toBeNull();
    expect(claimed.failedAt).toBeNull();

    await expect.poll(async () => (await row(message.id)).status).toBe('sent');
    const sent = smtp.received.find((raw) => raw.includes(message.recipientEmail))!;
    expect(sent).toMatch(new RegExp(`Message-ID: <email-${message.id}-1@akf-tenders\\.test>`, 'i'));
    // The raw message is quoted-printable; drop its soft line breaks.
    expect(sent.replace(/=\r\n/g, '')).toContain('/en/account-setup#token=');
    expect(await recovery.retry(message.id)).toBe(false);
  });
});
