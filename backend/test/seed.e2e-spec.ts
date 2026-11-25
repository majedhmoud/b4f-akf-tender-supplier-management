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
  DEMO_SUPPLIER_DOMAIN,
  DEMO_DOMAIN,
  DEMO_STAFF_PASSWORD,
  DEMO_SUPPLIER_PASSWORD,
  refreshDemoTenders,
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
    expect(await prisma.userAccount.count({ where: { email: { endsWith: DEMO_DOMAIN } } })).toBe(7);
    expect(
      await prisma.supplierApplication.count({
        where: { contactEmail: { endsWith: DEMO_SUPPLIER_DOMAIN } },
      }),
    ).toBe(6);
    expect(await prisma.tender.count({ where: demoUsers })).toBe(13);
    const tenderStatuses = await prisma.tender.findMany({
      where: demoUsers,
      select: { status: true },
    });
    expect(tenderStatuses.map(({ status }) => status).sort()).toEqual(
      summary.tenders.map(({ status }) => status).sort(),
    );
    expect(await prisma.tenderAward.count({ where: { tender: demoUsers } })).toBe(2);
    const messages = await prisma.emailMessage.groupBy({
      by: ['status'],
      where: { tender: demoUsers },
      _count: { _all: true },
    });
    expect(Object.fromEntries(messages.map(({ status, _count }) => [status, _count._all]))).toEqual(
      { draft: 4, sent: 1, failed: 1 },
    );
    expect(await prisma.bidRanking.count({ where: { tender: demoUsers } })).toBe(6);
  });

  it('refreshes tender data in place, retaining accounts and populating every submitted custom field', async () => {
    const employee = await prisma.userAccount.findUniqueOrThrow({
      where: { email: 'employee@akf.org' },
    });
    const before = await prisma.tender.findMany({ select: { id: true } });
    await refreshDemoTenders(prisma, app.get(FileStorage));
    const after = await prisma.tender.findMany({
      include: {
        formFields: { include: { translations: true } },
        bids: { include: { parts: { include: { answers: true } } } },
      },
    });
    expect(after).toHaveLength(13);
    expect(after.every((tender) => !before.some(({ id }) => id === tender.id))).toBe(true);
    expect(after.every((tender) => tender.requestedByUserId === employee.id)).toBe(true);
    expect(
      after
        .filter((tender) => tender.status === 'cancelled')
        .map((tender) => tender.cancellationReason)
        .sort(),
    ).toEqual(['no_bids', 'no_qualified_bid']);
    for (const tender of after) {
      for (const field of tender.formFields) {
        expect(field.translations).toHaveLength(2);
        expect(field.translations.every(({ instructions }) => !!instructions)).toBe(true);
      }
      for (const part of tender.bids.flatMap(({ parts }) => parts)) {
        const fields = tender.formFields.filter(({ partType }) => partType === part.partType);
        expect(part.answers).toHaveLength(fields.length);
        for (const answer of part.answers) {
          expect(answer.scalarValue !== null || answer.documentId !== null).toBe(true);
        }
      }
    }
  });

  it('lets each demo account sign in with the demo password', async () => {
    for (const account of DEMO_ACCOUNTS) {
      const client = new TestClient(app.getHttpServer());
      const response = await client.signIn(account.email, DEMO_STAFF_PASSWORD);
      expect(response.status, account.email).toBe(200);
      expect(response.body.user.roles).toEqual([account.role]);
    }
  });

  it('lets active suppliers use the supplier password and see their staged bid', async () => {
    const client = new TestClient(app.getHttpServer());
    const response = await client.signIn('cedar-supplies@example.com', DEMO_SUPPLIER_PASSWORD);
    expect(response.status).toBe(200);
    expect(response.body.user.roles).toEqual(['supplier']);
    const bid = await prisma.bid.findFirstOrThrow({
      where: {
        supplier: { user: { email: 'cedar-supplies@example.com' } },
        tender: { status: 'published' },
      },
      include: { parts: true },
    });
    expect(bid.parts.map(({ partType }) => partType)).toEqual(['legal_information']);
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
    await legal.signIn(`legal${DEMO_DOMAIN}`, DEMO_STAFF_PASSWORD);
    const pending = await legal.get('/api/v1/signup-reviews?status=pending&limit=100');
    const pendingNames = (pending.body.data as { legalName: string }[]).map((a) => a.legalName);
    expect(pendingNames).toContain('Al-Noor Engineering');
    expect(pendingNames).not.toContain('Sahel Builders');

    const admin = new TestClient(app.getHttpServer());
    await admin.signIn(`admin${DEMO_DOMAIN}`, DEMO_STAFF_PASSWORD);
    const raised = await admin.get('/api/v1/signup-requests?status=raised&limit=100');
    const raisedNames = (raised.body.data as { legalName: string }[]).map((a) => a.legalName);
    expect(raisedNames).toContain('Sahel Builders');
    expect(raisedNames).not.toContain('Rawda Contracting');
    expect(raisedNames).not.toContain('Wadi Supplies');
  });

  it('leaves one supplier waiting for setup, with its email ready to send', async () => {
    const account = await prisma.userAccount.findUniqueOrThrow({
      where: { email: `wadi-supplies${DEMO_SUPPLIER_DOMAIN}` },
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
