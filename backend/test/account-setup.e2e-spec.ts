import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashToken, SetupTokens } from '../src/account-setup/setup-tokens.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { VISITOR_COOKIE } from '../src/auth/auth.settings.js';
import type { Language, Role } from '../src/generated/prisma/client.js';
import { EmailRecovery } from '../src/notifications/email-recovery.js';
import { accountSetupEmail } from '../src/notifications/email-templates.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { tokenFrom, waitForEmails } from './support/mailpit.js';
import { uniqueRunId } from './support/run-id.js';
import { TestClient } from './support/test-client.js';

// U7 and account setup S1–S3 with real Redis/BullMQ and Mailpit
// (docs/07_CONTRACTS/ACCOUNT_SETUP_EMAIL.md). Each case uses its own
// fictional address, so Mailpit searches never see another test's email.
process.env.COOKIE_SECURE = 'false';
process.env.SIGN_IN_RATE_LIMIT = '1000';
process.env.APPLICATION_RATE_LIMIT = '1000';
process.env.ACCOUNT_SETUP_RATE_LIMIT = '1000';
process.env.FILE_STORAGE_DIR = `storage-test-setup-${process.pid}`;
process.env.WEB_ORIGIN = 'http://localhost:3000';
const PDF = Buffer.from('%PDF-1.7\nCertificate');
const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'a brand new setup password';
const SETUP = '/api/v1/account-setup';

// Real SMTP delivery and bcrypt take longer than the default 5 seconds.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

describe('Admin acceptance and account setup (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let recovery: EmailRecovery;
  let legal: TestClient;
  let admin: TestClient;
  const runId = uniqueRunId();
  const domain = `@setup-${runId}.test`;
  const staff: string[] = [];
  const scopes: string[] = [];
  let number = 0;

  async function guest() {
    const client = new TestClient(app.getHttpServer());
    await client.fetchCsrf();
    scopes.push(client.cookies.get(VISITOR_COOKIE)!.split('.')[0]);
    return client;
  }

  async function signedIn(role: Role) {
    const row = await prisma.userAccount.create({
      data: {
        email: `${role}${domain}`,
        displayName: role,
        preferredLanguage: 'en',
        status: 'active',
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        roles: { create: { role } },
      },
    });
    staff.push(row.id);
    const client = new TestClient(app.getHttpServer());
    await client.signIn(row.email, PASSWORD);
    return client;
  }

  // A guest application through U1, then the legal decision through U4.
  async function applied(
    language: Language = 'en',
    decision: 'accepted' | 'rejected' = 'accepted',
    extra: { contactEmail?: string; registrationNumber?: string } = {},
  ) {
    number += 1;
    const dto = {
      legalName: `Supplier ${number}`,
      registrationNumber: extra.registrationNumber ?? `CR-${runId}-${number}`,
      contactEmail: extra.contactEmail ?? `applicant-${number}${domain}`,
      preferredLanguage: language,
    };
    const client = await guest();
    const cookies = [...client.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const submitted = await request(app.getHttpServer())
      .post('/api/v1/supplier-applications')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', client.csrfToken)
      .set('Idempotency-Key', randomUUID())
      .field('application', JSON.stringify(dto))
      .field('languages[registration_certificate]', language)
      .field('languages[tax_certificate]', language)
      .attach('files[registration_certificate]', PDF, {
        filename: 'register.pdf',
        contentType: 'application/pdf',
      })
      .attach('files[tax_certificate]', PDF, {
        filename: 'tax.pdf',
        contentType: 'application/pdf',
      });
    expect(submitted.status).toBe(201);
    const id = submitted.body.applicationId as string;
    const reviewed = await legal.send('post', `/api/v1/supplier-applications/${id}/review`, {
      decision,
      reason: decision === 'rejected' ? 'Expired certificate' : null,
    });
    expect(reviewed.status).toBe(201);
    return { id, email: dto.contactEmail, registrationNumber: dto.registrationNumber };
  }

  const accept = (id: string, client = admin) =>
    client.send('post', `/api/v1/signup-requests/${id}/accept`);

  async function accepted(language: Language = 'en') {
    const application = await applied(language);
    const result = await accept(application.id);
    expect(result.status).toBe(200);
    const [email] = await waitForEmails(application.email);
    return {
      ...application,
      supplierId: result.body.supplierId as string,
      email,
      token: tokenFrom(email.Text),
    };
  }

  // The person who opened the link: a guest browser with a CSRF token.
  const linkHolder = guest;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    recovery = app.get(EmailRecovery);
    legal = await signedIn('legal_committee');
    admin = await signedIn('admin');
  });

  afterAll(async () => {
    const applications = await prisma.supplierApplication.findMany({
      where: { contactEmail: { endsWith: domain } },
      select: { id: true },
    });
    const ids = applications.map((row) => row.id);
    const accounts = await prisma.userAccount.findMany({
      where: { email: { endsWith: domain } },
      select: { id: true },
    });
    const users = accounts.map((row) => row.id);
    await prisma.auditEvent.deleteMany({
      where: {
        OR: [{ actorUserId: { in: users } }, { resourceId: { in: [...ids, ...users] } }],
      },
    });
    await prisma.emailMessage.deleteMany({ where: { recipientUserId: { in: users } } });
    await prisma.supplier.deleteMany({ where: { applicationId: { in: ids } } });
    await prisma.signupReview.deleteMany({ where: { applicationId: { in: ids } } });
    await prisma.document.deleteMany({
      where: { applicationLink: { applicationId: { in: ids } } },
    });
    await prisma.supplierApplication.deleteMany({ where: { id: { in: ids } } });
    if (scopes.length)
      await prisma.$executeRaw`DELETE FROM idempotency_keys WHERE guest_scope_id=ANY(${scopes}::uuid[])`;
    await prisma.userAccount.deleteMany({ where: { id: { in: users } } });
    await app.close();
    await rm(process.env.FILE_STORAGE_DIR!, { recursive: true, force: true });
  });

  describe.each<[Language, string]>([
    ['en', 'Set up your AKF Tenders account'],
    ['ar', 'إعداد حسابك في منصة مناقصات مؤسسة الآغا خان'],
  ])('the full path in %s', (language, subject) => {
    it('provisions once, emails the link, verifies twice, and completes once', async () => {
      const application = await applied(language);

      const result = await accept(application.id);
      expect(result.status).toBe(200);
      expect(result.headers['cache-control']).toBe('private, no-store');
      expect(result.body).toEqual({
        supplierId: expect.any(String),
        accountStatus: 'pending_setup',
        setupEmail: { language, status: 'sending' },
      });

      // One supplier, account, token and email, committed together.
      const account = await prisma.userAccount.findUniqueOrThrow({
        where: { email: application.email },
        include: { roles: true, supplier: true, setupTokens: true, emailsReceived: true },
      });
      expect(account.status).toBe('pending_setup');
      expect(account.passwordHash).toBeNull();
      expect(account.preferredLanguage).toBe(language);
      expect(account.roles.map((r) => r.role)).toEqual(['supplier']);
      expect(account.supplier).toMatchObject({
        id: result.body.supplierId,
        applicationId: application.id,
        registrationNumber: application.registrationNumber,
        status: 'active',
      });
      expect(account.setupTokens).toHaveLength(1);
      expect(account.emailsReceived).toHaveLength(1);
      expect(account.emailsReceived[0]).toMatchObject({
        kind: 'account_setup',
        recipientEmail: application.email,
        language,
        subject,
      });

      // Delivered through SMTP to the applicant, in their language.
      const [email] = await waitForEmails(application.email);
      expect(email.To.map((t) => t.Address)).toEqual([application.email]);
      expect(email.Subject).toBe(subject);
      expect(email.Text).toContain(`http://localhost:3000/${language}/account-setup#token=`);
      expect(email.Text).not.toMatch(/[?&]token=|\/account-setup\/[A-Za-z0-9_-]{20,}/);
      expect(email.MessageID).toMatch(/^email-[0-9a-f-]+-1@akf-tenders\.test$/);
      const token = tokenFrom(email.Text);

      // Only the hash is stored; the email row keeps a placeholder.
      const [stored] = account.setupTokens;
      expect(stored.tokenHash).toBe(hashToken(token));
      expect(stored.tokenHash).not.toContain(token);
      expect(account.emailsReceived[0].body).toContain('{{setupLink}}');
      expect(account.emailsReceived[0].body).not.toContain(token);
      await expect
        .poll(
          async () =>
            (
              await prisma.emailMessage.findUniqueOrThrow({
                where: { id: account.emailsReceived[0].id },
              })
            ).status,
        )
        .toBe('sent');

      // Audited: acceptance, account creation, and the link sent.
      const actions = await prisma.auditEvent.findMany({
        where: { resourceId: { in: [application.id, account.id] } },
        select: { action: true },
      });
      expect(actions.map((a) => a.action)).toEqual(
        expect.arrayContaining([
          'signup_request.accepted',
          'supplier_account.created',
          'account_setup_link.sent',
        ]),
      );

      // S1 twice: both succeed and leave the token usable.
      const holder = await linkHolder();
      for (let i = 0; i < 2; i += 1) {
        const verified = await holder.send('post', `${SETUP}/verify`, { token });
        expect(verified.status).toBe(200);
        expect(verified.body).toEqual({
          email: `a***${domain}`,
          preferredLanguage: language,
          accountType: 'supplier',
        });
      }
      expect(
        (await prisma.accountSetupToken.findUniqueOrThrow({ where: { id: stored.id } })).usedAt,
      ).toBeNull();

      // S2: a short password is a field error and leaves the link usable.
      const weak = await holder.send('post', `${SETUP}/complete`, {
        token,
        password: 'short',
      });
      expect(weak.status).toBe(400);
      expect(weak.body.error.code).toBe('VALIDATION_FAILED');
      expect(weak.body.error.fields).toEqual([{ field: 'password', code: 'PASSWORD_TOO_WEAK' }]);

      const done = await holder.send('post', `${SETUP}/complete`, {
        token,
        password: NEW_PASSWORD,
      });
      expect(done.status).toBe(200);
      expect(done.body).toMatchObject({
        user: { email: application.email, preferredLanguage: language, roles: ['supplier'] },
        next: 'supplier_profile',
      });
      expect((await holder.get('/api/v1/auth/session')).status).toBe(200);
      // A new session needs a new CSRF token (API_CONTRACT.md, account setup).
      await holder.fetchCsrf();

      const active = await prisma.userAccount.findUniqueOrThrow({ where: { id: account.id } });
      expect(active.status).toBe('active');
      expect(active.emailVerifiedAt).not.toBeNull();
      expect(await bcrypt.compare(NEW_PASSWORD, active.passwordHash!)).toBe(true);
      expect(
        await prisma.auditEvent.count({
          where: { resourceId: account.id, action: 'account.password_set' },
        }),
      ).toBe(1);

      // The link is used up; the new password signs in.
      const again = await holder.send('post', `${SETUP}/complete`, {
        token,
        password: NEW_PASSWORD,
      });
      expect(again.status).toBe(410);
      expect(again.body.error.code).toBe('SETUP_LINK_USED');
      expect((await holder.send('post', `${SETUP}/verify`, { token })).body.error.code).toBe(
        'SETUP_LINK_USED',
      );
      const signIn = new TestClient(app.getHttpServer());
      await signIn.signIn(application.email, NEW_PASSWORD);
      expect((await signIn.get('/api/v1/auth/session')).status).toBe(200);
    });
  });

  it('keeps the email language from preparation time', async () => {
    const { email: address, id } = await applied('ar');
    expect((await accept(id)).status).toBe(200);
    await prisma.userAccount.update({
      where: { email: address },
      data: { preferredLanguage: 'en' },
    });
    const [email] = await waitForEmails(address);
    expect(email.Subject).toBe(accountSetupEmail('ar', 'x').subject);
    expect(email.Text).toContain('/ar/account-setup#token=');
    const row = await prisma.emailMessage.findFirstOrThrow({ where: { recipientEmail: address } });
    expect(row.language).toBe('ar');
  });

  it('answers ALREADY_ACCEPTED with the supplier, also for simultaneous requests', async () => {
    const { id, email } = await applied();
    const [first, second] = await Promise.all([accept(id), accept(id)]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const winner = first.status === 200 ? first : second;
    const loser = first.status === 200 ? second : first;
    expect(loser.body.error.code).toBe('ALREADY_ACCEPTED');
    expect(loser.body.error.details).toEqual({ supplierId: winner.body.supplierId });

    const later = await accept(id);
    expect(later.status).toBe(409);
    expect(later.body.error.details.supplierId).toBe(winner.body.supplierId);
    expect(await prisma.supplier.count({ where: { applicationId: id } })).toBe(1);
    expect(await prisma.emailMessage.count({ where: { recipientEmail: email } })).toBe(1);
    await waitForEmails(email);
  });

  it('refuses an email that has an account meanwhile, and keeps the request raised', async () => {
    const contactEmail = `taken-${runId}${domain}`;
    const { id } = await applied('en', 'accepted', { contactEmail });
    const account = await prisma.userAccount.create({
      data: {
        email: contactEmail,
        displayName: 'Taken',
        preferredLanguage: 'en',
        status: 'active',
      },
    });
    const result = await accept(id);
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
    expect(await prisma.supplier.count({ where: { applicationId: id } })).toBe(0);
    await prisma.userAccount.delete({ where: { id: account.id } });
  });

  it('refuses a registration number another supplier has, and keeps the request raised', async () => {
    // Both raised before either is accepted; U1 already refuses a taken number.
    const first = await applied();
    const { id } = await applied('en', 'accepted', {
      registrationNumber: first.registrationNumber,
    });
    expect((await accept(first.id)).status).toBe(200);
    await waitForEmails(first.email);
    const result = await accept(id);
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('REGISTRATION_NUMBER_EXISTS');
    const review = await prisma.signupReview.findUniqueOrThrow({ where: { applicationId: id } });
    expect(review.adminAcceptedAt).toBeNull();
    expect((await admin.get(`/api/v1/signup-requests/${id}`)).status).toBe(200);
  });

  it('answers 404 for a rejected request, an unknown one, and a non-admin', async () => {
    const rejected = await applied('en', 'rejected');
    expect((await accept(rejected.id)).status).toBe(404);
    expect(await prisma.userAccount.count({ where: { email: rejected.email } })).toBe(0);
    expect((await accept(randomUUID())).status).toBe(404);

    const { id } = await applied();
    expect((await accept(id, legal)).status).toBe(404);
    expect(await prisma.supplier.count({ where: { applicationId: id } })).toBe(0);
  });

  it('lets only one of two simultaneous completions succeed', async () => {
    const { token } = await accepted();
    const holder = await linkHolder();
    const results = await Promise.all([
      holder.send('post', `${SETUP}/complete`, { token, password: NEW_PASSWORD }),
      holder.send('post', `${SETUP}/complete`, { token, password: NEW_PASSWORD }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 410]);
  });

  it('answers 404 for an unknown link, and needs the CSRF header', async () => {
    const holder = await linkHolder();
    const unknown = await holder.send('post', `${SETUP}/verify`, { token: 'not-a-real-token' });
    expect(unknown.status).toBe(404);
    expect(
      (await holder.send('post', `${SETUP}/verify`, { token: 'x' }, false)).body.error.code,
    ).toBe('CSRF_TOKEN_INVALID');
  });

  it('expires links after 48 hours, and resends a new usable link', async () => {
    const { id, token, email } = await accepted('ar');
    const account = await prisma.userAccount.findUniqueOrThrow({
      where: { email: email.To[0].Address },
    });
    const issued = await prisma.accountSetupToken.findFirstOrThrow({
      where: { userId: account.id },
    });
    const hours = (issued.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(47.9);
    expect(hours).toBeLessThanOrEqual(48);

    // The test clock: move the expiry into the past.
    await prisma.accountSetupToken.update({
      where: { id: issued.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const holder = await linkHolder();
    for (const body of [{ token }, { token, password: NEW_PASSWORD }]) {
      const expired = await holder.send(
        'post',
        `${SETUP}/${'password' in body ? 'complete' : 'verify'}`,
        body,
      );
      expect(expired.status).toBe(410);
      expect(expired.body.error.code).toBe('SETUP_LINK_EXPIRED');
    }

    const resent = await holder.send('post', `${SETUP}/resend`, { token });
    expect(resent.status).toBe(202);
    const emails = await waitForEmails(account.email, 2);
    const fresh = emails.map((e) => tokenFrom(e.Text)).find((t) => t !== token)!;
    expect(fresh).toBeDefined();
    expect(emails.every((e) => e.Text.includes('/ar/account-setup#token='))).toBe(true);
    expect((await holder.send('post', `${SETUP}/verify`, { token: fresh })).status).toBe(200);
    expect((await holder.send('post', `${SETUP}/verify`, { token })).status).toBe(410);
    expect(await prisma.supplier.count({ where: { applicationId: id } })).toBe(1);
  });

  it('answers 202 to every resend, sending nothing for unknown, used or valid links', async () => {
    const holder = await linkHolder();
    const unknown = await holder.send('post', `${SETUP}/resend`, { token: 'not-a-real-token' });
    expect(unknown.status).toBe(202);

    const { token, email } = await accepted();
    const address = email.To[0].Address;
    expect((await holder.send('post', `${SETUP}/resend`, { token })).status).toBe(202);
    await holder.send('post', `${SETUP}/complete`, { token, password: NEW_PASSWORD });
    await holder.fetchCsrf();
    expect((await holder.send('post', `${SETUP}/resend`, { token })).status).toBe(202);

    const account = await prisma.userAccount.findUniqueOrThrow({ where: { email: address } });
    expect(await prisma.accountSetupToken.count({ where: { userId: account.id } })).toBe(1);
    expect(await prisma.emailMessage.count({ where: { recipientUserId: account.id } })).toBe(1);
  });

  it('sends at most 5 links an hour to one account, the first one included', async () => {
    const { token, email } = await accepted();
    const account = await prisma.userAccount.findUniqueOrThrow({
      where: { email: email.To[0].Address },
    });
    const holder = await linkHolder();
    for (let i = 0; i < 6; i += 1) {
      // The test clock: every link so far has expired; the first stays unused.
      await prisma.accountSetupToken.updateMany({
        where: { userId: account.id },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });
      expect((await holder.send('post', `${SETUP}/resend`, { token })).status).toBe(202);
    }
    expect(await prisma.emailMessage.count({ where: { recipientUserId: account.id } })).toBe(5);
  });

  it('recovers a committed email whose enqueue never happened, exactly once', async () => {
    const address = `recovered-${runId}${domain}`;
    const account = await prisma.userAccount.create({
      data: {
        email: address,
        displayName: 'Recovered',
        preferredLanguage: 'en',
        status: 'pending_setup',
      },
    });
    // What U7 commits before the enqueue: a token and a `sending` email.
    const tokens = app.get(SetupTokens);
    const { id: messageId } = await prisma.$transaction(async (tx) => {
      await tokens.issue(tx, account.id);
      return tx.emailMessage.create({
        data: {
          kind: 'account_setup',
          recipientUserId: account.id,
          recipientEmail: address,
          language: 'en',
          ...accountSetupEmail('en', 'Recovered'),
          status: 'sending',
        },
      });
    });

    expect(await recovery.sweep({ id: { in: [messageId] } })).toBe(1);
    const [email] = await waitForEmails(address);
    expect(email.Text).toContain('/en/account-setup#token=');
    await expect
      .poll(
        async () =>
          (await prisma.emailMessage.findUniqueOrThrow({ where: { id: messageId } })).status,
      )
      .toBe('sent');
    expect(await recovery.sweep({ id: { in: [messageId] } })).toBe(0);
  });
});
