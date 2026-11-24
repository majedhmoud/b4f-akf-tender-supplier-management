import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { rm } from 'node:fs/promises';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { Role } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TestClient } from './support/test-client.js';
import { uniqueRunId } from './support/run-id.js';

// Pins T1, T2, T2d, and R1 (API_CONTRACT.md, Public Tenders and Reference)
// and the S1 checks: only published tenders, never the estimated balance or
// scoring, language fallback, the cache rules of §1.2, and no staff endpoint
// for a guest.
process.env.COOKIE_SECURE = 'false';
process.env.SIGN_IN_RATE_LIMIT = '1000';
process.env.FILE_STORAGE_DIR = `storage-test-public-${process.pid}`;

const PASSWORD = 'correct horse battery staple';
const PDF = Buffer.from('%PDF-1.7\nTerms of Reference');

describe('Public tenders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runId = uniqueRunId();
  const category = `test-${runId}`;
  const otherCategory = `test-other-${runId}`;
  const userIds: string[] = [];
  const guest = () => request(app.getHttpServer());
  let employeeId: string;
  let publishedId: string;
  let documentId: string;
  let arabicOnlyId: string;
  let draftId: string;

  const future = (days: number) => new Date(Date.now() + days * 86_400_000);

  async function signedIn(label: string, role: Role) {
    const user = await prisma.userAccount.create({
      data: {
        email: `${label}-${runId}@test.local`,
        displayName: `Test ${label}`,
        preferredLanguage: 'en',
        status: 'active',
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        roles: { create: { role } },
      },
    });
    userIds.push(user.id);
    const client = new TestClient(app.getHttpServer());
    await client.signIn(`${label}-${runId}@test.local`, PASSWORD);
    return { client, id: user.id };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.tenderCategory.createMany({
      data: [{ code: category }, { code: otherCategory }],
    });

    const employee = await signedIn('employee', 'employee');
    employeeId = employee.id;
    const { client: officer } = await signedIn('officer', 'procurement_officer');

    // One tender through the real path, with Terms of Reference.
    const created = await employee.client.send('post', '/api/v1/employee/tenders', {
      categoryCode: category,
      estimatedBalance: { amount: '125000.00', currency: 'USD' },
      translations: [
        { language: 'en', title: 'School maintenance', description: 'Roof repairs.' },
        { language: 'ar', title: 'صيانة المدرسة', description: 'إصلاح السقف.' },
      ],
    });
    publishedId = created.body.id as string;
    const base = `/api/v1/manage/tenders/${publishedId}`;
    await officer.send('post', `${base}/accept`, {
      revision: 1,
      technicalWeight: 70,
      financialWeight: 30,
      minimumTechnicalScore: 60,
    });
    const upload = await officer.upload(
      `${base}/documents`,
      { revision: '2', kind: 'terms_of_reference', language: 'ar' },
      { name: 'ToR.pdf', type: 'application/pdf', content: PDF },
    );
    documentId = upload.body.document.id as string;
    await officer.send('post', `${base}/publish`, {
      revision: 3,
      categoryCode: category,
      deadlines: {
        application: future(10).toISOString(),
        technical: future(17).toISOString(),
        financial: future(24).toISOString(),
      },
    });

    // Others straight in the database: Arabic-only published, and a draft.
    const deadlines = {
      applicationDeadline: future(10),
      technicalDeadline: future(17),
      financialDeadline: future(24),
    };
    const base2 = {
      requestedByUserId: employeeId,
      estimatedBalance: '5000.00',
      currencyCode: 'USD',
    };
    arabicOnlyId = (
      await prisma.tender.create({
        data: {
          ...base2,
          categoryCode: otherCategory,
          status: 'published',
          publishedAt: new Date(),
          ...deadlines,
          translations: {
            create: { language: 'ar', title: 'لوازم مدرسية', description: 'دفاتر.' },
          },
        },
      })
    ).id;
    draftId = (
      await prisma.tender.create({
        data: {
          ...base2,
          categoryCode: category,
          translations: { create: { language: 'en', title: 'Secret draft', description: 'No.' } },
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.document.deleteMany({ where: { uploadedByUserId: { in: userIds } } });
    await prisma.tender.deleteMany({ where: { requestedByUserId: { in: userIds } } });
    await prisma.userAccount.deleteMany({ where: { id: { in: userIds } } });
    await prisma.tenderCategory.deleteMany({ where: { code: { in: [category, otherCategory] } } });
    await app.close();
    await rm(process.env.FILE_STORAGE_DIR ?? '', { recursive: true, force: true });
  });

  it('lists only published tenders, publicly cacheable, without the estimated balance', async () => {
    const response = await guest().get('/api/v1/tenders?limit=100');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=60');
    expect(response.headers.vary).toContain('Accept-Language');
    const ids = (response.body.data as { id: string }[]).map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining([publishedId, arabicOnlyId]));
    expect(ids).not.toContain(draftId);
    expect(JSON.stringify(response.body)).not.toMatch(/estimatedBalance|scoring|125000/);
  });

  it('filters by category and falls back to the other language', async () => {
    const response = await guest()
      .get(`/api/v1/tenders?category=${otherCategory}`)
      .set('Accept-Language', 'en');

    expect(response.body.data).toEqual([
      expect.objectContaining({
        id: arabicOnlyId,
        content: { language: 'ar', title: 'لوازم مدرسية' },
        requestedLanguage: 'en',
        isFallback: true,
      }),
    ]);
  });

  it('returns a published tender in the requested language, with its Content-Language', async () => {
    const response = await guest()
      .get(`/api/v1/tenders/${publishedId}`)
      .set('Accept-Language', 'ar');

    expect(response.status).toBe(200);
    expect(response.headers['content-language']).toBe('ar');
    expect(response.headers['cache-control']).toBe('public, max-age=60');
    expect(response.body).toMatchObject({
      id: publishedId,
      status: 'published',
      content: { language: 'ar', title: 'صيانة المدرسة' },
      isFallback: false,
      availableLanguages: ['ar', 'en'],
      deadlines: { application: expect.any(String) },
      documents: [expect.objectContaining({ id: documentId, name: 'ToR.pdf' })],
      serverTime: expect.any(String),
    });
    for (const key of ['estimatedBalance', 'scoring', 'requestedBy', 'revision']) {
      expect(response.body).not.toHaveProperty(key);
    }
  });

  it('answers 404, never cached, for a tender that is not published', async () => {
    const response = await guest().get(`/api/v1/tenders/${draftId}`);

    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('private, no-store');
  });

  it('gives anyone a signed download for a published tender, never cached', async () => {
    const link = await guest().get(
      `/api/v1/tenders/${publishedId}/documents/${documentId}/download`,
    );

    expect(link.status).toBe(200);
    expect(link.headers['cache-control']).toBe('private, no-store');
    const file = await guest().get(link.body.url as string);
    expect(file.status).toBe(200);
    expect(Buffer.from(file.body as Buffer).toString()).toContain('%PDF');

    const hidden = await guest().get(`/api/v1/tenders/${draftId}/documents/${documentId}/download`);
    expect(hidden.status).toBe(404);
  });

  it('lists the categories, publicly cacheable', async () => {
    const response = await guest().get('/api/v1/reference/tender-categories?limit=100');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=60');
    expect(response.body.data).toEqual(expect.arrayContaining([{ code: category }]));
    expect(response.body.meta).toMatchObject({ page: 1, limit: 100 });
  });

  it('refuses every staff endpoint to a guest, and never caches private responses', async () => {
    const staffPaths = [
      '/api/v1/auth/session',
      '/api/v1/employee/tenders',
      `/api/v1/employee/tenders/${publishedId}`,
      '/api/v1/manage/tenders',
      `/api/v1/manage/tenders/${publishedId}`,
      `/api/v1/manage/tenders/${publishedId}/bid-form`,
    ];
    for (const path of staffPaths) {
      const response = await guest().get(path);
      expect(response.status, path).toBe(401);
      expect(response.headers['cache-control'], path).toBe('private, no-store');
    }

    const health = await guest().get('/api/v1/health');
    expect(health.headers['cache-control']).toBe('private, no-store');
  });
});
