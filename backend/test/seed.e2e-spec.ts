import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { SetupTokens } from '../src/account-setup/setup-tokens.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  DEMO_ACCOUNTS,
  DEMO_APPLICANT_DOMAIN,
  DEMO_DOMAIN,
  DEMO_PASSWORD,
  seed,
} from '../src/seed/seed.js';
import { FileStorage } from '../src/storage/file-storage.js';
import { TestClient } from './support/test-client.js';

// Pins the S1 seed (docs/06_SLICES/S1_TENDER_PUBLISHING.md, "Seed data"): it
// runs again safely, and the README's demo accounts can sign in. It uses the
// normal storage folder, so the local demo data stays usable afterwards.
process.env.COOKIE_SECURE = 'false';
process.env.SIGN_IN_RATE_LIMIT = '1000';

describe('Seed (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('can run twice and leaves exactly one set of demo data', async () => {
    const storage = app.get(FileStorage);
    const tokens = app.get(SetupTokens);
    await seed(prisma, storage, tokens);
    const summary = await seed(prisma, storage, tokens);

    const demoUsers = { requestedBy: { email: { endsWith: DEMO_DOMAIN } } };
    expect(await prisma.userAccount.count({ where: { email: { endsWith: DEMO_DOMAIN } } })).toBe(4);
    expect(
      await prisma.supplierApplication.count({
        where: { contactEmail: { endsWith: DEMO_APPLICANT_DOMAIN } },
      }),
    ).toBe(4);
    expect(await prisma.tender.count({ where: demoUsers })).toBe(5);
    expect(summary.tenders.map((t) => t.status)).toEqual([
      'draft',
      'accepted',
      'published',
      'published',
      'cancelled',
    ]);
  });

  it('lets each demo account sign in with the demo password', async () => {
    for (const account of DEMO_ACCOUNTS) {
      const client = new TestClient(app.getHttpServer());
      const response = await client.signIn(account.email, DEMO_PASSWORD);
      expect(response.status, account.email).toBe(200);
      expect(response.body.user.roles).toEqual([account.role]);
    }
  });

  it('publishes demo tenders a guest can see, with downloadable Terms of Reference', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/tenders?limit=100');
    const laptops = (list.body.data as { id: string; content: { title: string } }[]).find(
      (t) => t.content.title === 'Laptops for teachers',
    );
    expect(laptops).toBeDefined();

    const detail = await request(app.getHttpServer()).get(`/api/v1/tenders/${laptops?.id}`);
    const [termsOfReference] = detail.body.documents as { id: string; translations: object[] }[];
    expect(termsOfReference.translations).toHaveLength(1);

    const link = await request(app.getHttpServer()).get(
      `/api/v1/tenders/${laptops?.id}/documents/${termsOfReference.id}/download`,
    );
    const file = await request(app.getHttpServer()).get(link.body.url as string);
    expect(file.status).toBe(200);
    expect(
      Buffer.from(file.body as Buffer)
        .subarray(0, 4)
        .toString(),
    ).toBe('%PDF');
  });

  it('gives the legal reviewer a pending application and the admin a raised one', async () => {
    const legal = new TestClient(app.getHttpServer());
    await legal.signIn(`legal${DEMO_DOMAIN}`, DEMO_PASSWORD);
    const pending = await legal.get('/api/v1/signup-reviews?status=pending&limit=100');
    const pendingNames = (pending.body.data as { legalName: string }[]).map((a) => a.legalName);
    expect(pendingNames).toContain('Al-Noor Engineering');
    expect(pendingNames).not.toContain('Sahel Builders');

    const admin = new TestClient(app.getHttpServer());
    await admin.signIn(`admin${DEMO_DOMAIN}`, DEMO_PASSWORD);
    const raised = await admin.get('/api/v1/signup-requests?status=raised&limit=100');
    const raisedNames = (raised.body.data as { legalName: string }[]).map((a) => a.legalName);
    expect(raisedNames).toContain('Sahel Builders');
    expect(raisedNames).not.toContain('Rawda Contracting');
    expect(raisedNames).not.toContain('Wadi Supplies');
  });

  it('leaves one supplier waiting for setup, with its email ready to send', async () => {
    const account = await prisma.userAccount.findUniqueOrThrow({
      where: { email: `sales@wadi${DEMO_APPLICANT_DOMAIN}` },
      include: { supplier: true, setupTokens: true, emailsReceived: true },
    });
    expect(account.status).toBe('pending_setup');
    expect(account.supplier?.registrationNumber).toBe('CR-DEMO-1004');
    expect(account.setupTokens).toHaveLength(1);
    expect(account.emailsReceived.map((e) => [e.kind, e.status])).toEqual([
      ['account_setup', 'sending'],
    ]);
  });
});
