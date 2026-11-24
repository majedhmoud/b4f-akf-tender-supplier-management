import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { Role } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TestClient } from './support/test-client.js';
import { uniqueRunId } from './support/run-id.js';

// Pins Q1–Q4 (API_CONTRACT.md, Employee Tenders) and the S1 test list in
// docs/06_SLICES/S1_TENDER_PUBLISHING.md: own tenders only, 404 for anything
// else, the two 409 conflicts in the contract's check order, and audit.
process.env.COOKIE_SECURE = 'false';
process.env.SIGN_IN_RATE_LIMIT = '1000';

const PASSWORD = 'correct horse battery staple';
const BASE = '/api/v1/employee/tenders';

describe('Employee tenders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runId = uniqueRunId();
  const category = `test-${runId}`;
  const email = (label: string) => `${label}-${runId}@test.local`;
  const userIds: string[] = [];
  let lina: TestClient;
  let omar: TestClient;
  let officer: TestClient;

  const draft = (title = 'School maintenance') => ({
    categoryCode: category,
    estimatedBalance: { amount: '125000.00', currency: 'USD' },
    translations: [{ language: 'en', title, description: 'Repairs to the school roof.' }],
  });

  async function signedIn(label: string, role: Role) {
    const user = await prisma.userAccount.create({
      data: {
        email: email(label),
        displayName: `Test ${label}`,
        preferredLanguage: 'en',
        status: 'active',
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        roles: { create: { role } },
      },
    });
    userIds.push(user.id);
    const client = new TestClient(app.getHttpServer());
    await client.signIn(email(label), PASSWORD);
    return client;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.tenderCategory.create({ data: { code: category } });
    lina = await signedIn('lina', 'employee');
    omar = await signedIn('omar', 'employee');
    officer = await signedIn('officer', 'procurement_officer');
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.tender.deleteMany({ where: { requestedByUserId: { in: userIds } } });
    await prisma.userAccount.deleteMany({ where: { id: { in: userIds } } });
    await prisma.tenderCategory.deleteMany({ where: { code: category } });
    await app.close();
  });

  it('creates a draft at revision 1 and records an audit event', async () => {
    const response = await lina.send('post', BASE, draft());

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: expect.any(String), status: 'draft', revision: 1 });

    const events = await prisma.auditEvent.count({
      where: { action: 'draft_tender.created', resourceId: response.body.id },
    });
    expect(events).toBe(1);
  });

  it('refuses deadlines, scoring, and other fields an employee may not set', async () => {
    const response = await lina.send('post', BASE, {
      ...draft(),
      deadlines: { application: '2030-01-10T12:00:00Z' },
      technicalWeight: 70,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toEqual(
      expect.arrayContaining([
        { field: 'deadlines', code: 'FIELD_NOT_EDITABLE' },
        { field: 'technicalWeight', code: 'FIELD_NOT_EDITABLE' },
      ]),
    );
  });

  it('requires both a title and a description in each translation', async () => {
    const response = await lina.send('post', BASE, {
      ...draft(),
      translations: [{ language: 'en', title: '   ', description: '' }],
    });

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toEqual(
      expect.arrayContaining([
        { field: 'translations[0].title', code: 'REQUIRED' },
        { field: 'translations[0].description', code: 'REQUIRED' },
      ]),
    );
  });

  it('rejects an unknown category', async () => {
    const response = await lina.send('post', BASE, { ...draft(), categoryCode: 'no-such' });

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toEqual([{ field: 'categoryCode', code: 'INVALID' }]);
  });

  it('answers 404 to anyone without the employee role', async () => {
    const response = await officer.send('post', BASE, draft());

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it("lists only the employee's own tenders, newest first, paged, with language fallback", async () => {
    await omar.send('post', BASE, draft("Omar's tender"));

    const response = await lina.get(`${BASE}?page=1&limit=100`, { 'Accept-Language': 'ar' });

    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 100 });
    const items = response.body.data as { content: { title: string } }[];
    const titles = items.map((t) => t.content.title);
    expect(titles).not.toContain("Omar's tender");
    expect(response.body.data[0]).toMatchObject({
      status: 'draft',
      content: { language: 'en' },
      requestedLanguage: 'ar',
      isFallback: true,
    });
    const created = (response.body.data as { createdAt: string }[]).map((t) => t.createdAt);
    expect(created).toEqual([...created].sort().reverse());
  });

  it("returns the employee's own tender, and 404 for someone else's", async () => {
    const created = await lina.send('post', BASE, draft());
    const id = created.body.id as string;

    const own = await lina.get(`${BASE}/${id}`);
    expect(own.status).toBe(200);
    expect(own.body).toMatchObject({
      id,
      status: 'draft',
      revision: 1,
      estimatedBalance: { amount: '125000.00', currency: 'USD' },
      deadlines: null,
      documents: [],
      allowedActions: ['edit'],
    });
    expect(own.body).not.toHaveProperty('scoring');

    const other = await omar.get(`${BASE}/${id}`);
    expect(other.status).toBe(404);
  });

  it('edits a draft and increases the revision', async () => {
    const created = await lina.send('post', BASE, draft());
    const id = created.body.id as string;

    const response = await lina.send('patch', `${BASE}/${id}`, {
      revision: 1,
      translations: [
        { language: 'en', title: 'School maintenance, phase 2', description: 'Roof.' },
        { language: 'ar', title: 'صيانة المدرسة', description: 'السقف.' },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ revision: 2 });
    const stored = await lina.get(`${BASE}/${id}`);
    expect(stored.body.translations).toHaveLength(2);
  });

  it('answers a stale revision with VERSION_CONFLICT and the current revision', async () => {
    const created = await lina.send('post', BASE, draft());
    const id = created.body.id as string;
    await lina.send('patch', `${BASE}/${id}`, { revision: 1, categoryCode: category });

    const response = await lina.send('patch', `${BASE}/${id}`, {
      revision: 1,
      categoryCode: category,
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      code: 'VERSION_CONFLICT',
      details: { currentRevision: 2 },
    });
  });

  it('refuses edits after acceptance, checking status before the fields', async () => {
    const created = await lina.send('post', BASE, draft());
    const id = created.body.id as string;
    await prisma.tender.update({ where: { id }, data: { status: 'accepted' } });

    // The body is invalid too, but the status answers first (API_CONTRACT.md §1.4).
    const response = await lina.send('patch', `${BASE}/${id}`, {
      revision: 1,
      categoryCode: '',
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      code: 'TENDER_STATUS_CHANGED',
      details: { currentStatus: 'accepted' },
    });
    expect((await lina.get(`${BASE}/${id}`)).body.allowedActions).toEqual([]);
  });

  it('answers 404 before any conflict for a tender the employee may not see', async () => {
    const created = await omar.send('post', BASE, draft());

    const response = await lina.send('patch', `${BASE}/${created.body.id}`, { revision: 99 });

    expect(response.status).toBe(404);
  });
});
