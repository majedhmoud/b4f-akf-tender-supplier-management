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

// Pins M1–M11 and Q5 (API_CONTRACT.md, Tender Management) and the S1 test
// list: accept with scoring, edits while accepted, Terms of Reference files
// with signed downloads, the bid form editor, publishing and its lock, and
// copying a cancelled tender once.
process.env.COOKIE_SECURE = 'false';
process.env.SIGN_IN_RATE_LIMIT = '1000';
process.env.FILE_STORAGE_DIR = `storage-test-${process.pid}`;

const PASSWORD = 'correct horse battery staple';
const PDF = Buffer.from('%PDF-1.7\nTerms of Reference');
const MANAGE = '/api/v1/manage/tenders';

describe('Tender management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runId = uniqueRunId();
  const category = `test-${runId}`;
  const email = (label: string) => `${label}-${runId}@test.local`;
  const userIds: string[] = [];
  let employee: TestClient;
  let otherEmployee: TestClient;
  let officer: TestClient;

  const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
  const deadlines = { application: future(10), technical: future(17), financial: future(24) };

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

  async function createDraft(client = employee) {
    const response = await client.send('post', '/api/v1/employee/tenders', {
      categoryCode: category,
      estimatedBalance: { amount: '125000.00', currency: 'USD' },
      translations: [{ language: 'en', title: 'School maintenance', description: 'Roof.' }],
    });
    return response.body.id as string;
  }

  async function acceptedTender() {
    const id = await createDraft();
    await officer.send('post', `${MANAGE}/${id}/accept`, {
      revision: 1,
      technicalWeight: 70,
      financialWeight: 30,
      minimumTechnicalScore: 60,
    });
    return id;
  }

  const uploadToR = (id: string, revision: number, extra: Record<string, string> = {}) =>
    officer.upload(
      `${MANAGE}/${id}/documents`,
      { revision: String(revision), kind: 'terms_of_reference', language: 'ar', ...extra },
      { name: 'ToR.pdf', type: 'application/pdf', content: PDF },
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.tenderCategory.create({ data: { code: category } });
    employee = await signedIn('employee', 'employee');
    otherEmployee = await signedIn('other', 'employee');
    officer = await signedIn('officer', 'procurement_officer');
  });

  afterAll(async () => {
    const tenders = { requestedByUserId: { in: userIds } };
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.tender.deleteMany({ where: { ...tenders, copiedFromTenderId: { not: null } } });
    await prisma.document.deleteMany({ where: { uploadedByUserId: { in: userIds } } });
    await prisma.tender.deleteMany({ where: tenders });
    await prisma.userAccount.deleteMany({ where: { id: { in: userIds } } });
    await prisma.tenderCategory.deleteMany({ where: { code: category } });
    await app.close();
    await rm(process.env.FILE_STORAGE_DIR ?? '', { recursive: true, force: true });
  });

  it('answers 404 to an employee calling a management endpoint', async () => {
    const response = await employee.get(MANAGE);
    expect(response.status).toBe(404);
  });

  it('accepts a draft with scoring and records an audit event', async () => {
    const id = await createDraft();

    const response = await officer.send('post', `${MANAGE}/${id}/accept`, {
      revision: 1,
      technicalWeight: 70,
      financialWeight: 30,
      minimumTechnicalScore: 60,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'accepted', revision: 2 });
    const tender = await officer.get(`${MANAGE}/${id}`);
    expect(tender.body).toMatchObject({
      status: 'accepted',
      scoring: { technicalWeight: 70, financialWeight: 30, minimumTechnicalScore: 60 },
      requestedBy: { name: 'Test employee' },
      allowedActions: ['edit', 'upload_terms_of_reference', 'publish', 'raise_committee'],
    });
    expect(
      await prisma.auditEvent.count({ where: { action: 'draft_tender.accepted', resourceId: id } }),
    ).toBe(1);
  });

  it('rejects weights that do not add up to 100', async () => {
    const id = await createDraft();

    const response = await officer.send('post', `${MANAGE}/${id}/accept`, {
      revision: 1,
      technicalWeight: 70,
      financialWeight: 20,
      minimumTechnicalScore: 60,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toEqual([
      { field: 'technicalWeight', code: 'WEIGHTS_MUST_SUM_TO_100' },
    ]);
  });

  it('answers VERSION_CONFLICT when the employee edited the draft in the meantime', async () => {
    const id = await createDraft();
    await employee.send('patch', `/api/v1/employee/tenders/${id}`, {
      revision: 1,
      categoryCode: category,
    });

    const response = await officer.send('post', `${MANAGE}/${id}/accept`, {
      revision: 1,
      technicalWeight: 70,
      financialWeight: 30,
      minimumTechnicalScore: 60,
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      code: 'VERSION_CONFLICT',
      details: { currentRevision: 2 },
    });
  });

  it('lists tenders by status, newest first, with the requesting employee', async () => {
    const id = await acceptedTender();

    const response = await officer.get(`${MANAGE}?status=accepted&limit=100`);

    expect(response.status).toBe(200);
    const items = response.body.data as { id: string; status: string; requestedBy: object }[];
    expect(items.every((t) => t.status === 'accepted')).toBe(true);
    expect(items.find((t) => t.id === id)?.requestedBy).toMatchObject({ name: 'Test employee' });
  });

  it('uploads Terms of Reference, a translated copy, and serves signed downloads', async () => {
    const id = await acceptedTender();

    const original = await uploadToR(id, 2);
    expect(original.status).toBe(201);
    expect(original.body).toMatchObject({
      document: {
        kind: 'terms_of_reference',
        name: 'ToR.pdf',
        language: 'ar',
        translationOf: null,
      },
      revision: 3,
    });
    const originalId = original.body.document.id as string;

    const translation = await officer.upload(
      `${MANAGE}/${id}/documents`,
      { revision: '3', kind: 'terms_of_reference', language: 'en', translationOf: originalId },
      { name: 'ToR (en).pdf', type: 'application/pdf', content: PDF },
    );
    expect(translation.status).toBe(201);

    const tender = await officer.get(`${MANAGE}/${id}`);
    expect(tender.body.documents).toEqual([
      expect.objectContaining({
        id: originalId,
        translations: [expect.objectContaining({ language: 'en', name: 'ToR (en).pdf' })],
      }),
    ]);

    // The officer and the requesting employee can download; another employee cannot.
    const link = await officer.get(`${MANAGE}/${id}/documents/${originalId}/download`);
    expect(link.body).toMatchObject({ url: expect.stringMatching(/^\/api\/v1\/files\//) });
    const file = await request(app.getHttpServer()).get(link.body.url as string);
    expect(file.status).toBe(200);
    expect(file.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.from(file.body as Buffer).toString()).toContain('%PDF');

    const own = await employee.get(
      `/api/v1/employee/tenders/${id}/documents/${originalId}/download`,
    );
    expect(own.status).toBe(200);
    const other = await otherEmployee.get(
      `/api/v1/employee/tenders/${id}/documents/${originalId}/download`,
    );
    expect(other.status).toBe(404);

    // A tampered signature is refused.
    const tampered = await request(app.getHttpServer()).get(
      (link.body.url as string).replace(/signature=[^&]+/, 'signature=forged'),
    );
    expect(tampered.status).toBe(404);
  });

  it('refuses a second original of the same kind, a same-language translation, and a fake PDF', async () => {
    const id = await acceptedTender();
    const original = await uploadToR(id, 2);
    const originalId = original.body.document.id as string;

    const second = await uploadToR(id, 3);
    expect(second.body.error.fields).toEqual([{ field: 'kind', code: 'ALREADY_UPLOADED' }]);

    const sameLanguage = await uploadToR(id, 3, { translationOf: originalId });
    expect(sameLanguage.body.error.fields).toEqual([
      { field: 'language', code: 'TRANSLATION_SAME_LANGUAGE' },
    ]);

    const fake = await officer.upload(
      `${MANAGE}/${id}/documents`,
      { revision: '3', kind: 'other', language: 'en' },
      { name: 'notes.pdf', type: 'application/pdf', content: Buffer.from('MZ executable') },
    );
    expect(fake.status).toBe(415);
    expect(fake.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
  });

  it('removes an original together with its translations', async () => {
    const id = await acceptedTender();
    const original = await uploadToR(id, 2);
    const originalId = original.body.document.id as string;
    await officer.upload(
      `${MANAGE}/${id}/documents`,
      { revision: '3', kind: 'terms_of_reference', language: 'en', translationOf: originalId },
      { name: 'ToR (en).pdf', type: 'application/pdf', content: PDF },
    );

    const response = await officer.delete(`${MANAGE}/${id}/documents/${originalId}?revision=4`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ revision: 5 });
    expect((await officer.get(`${MANAGE}/${id}`)).body.documents).toEqual([]);
  });

  it('saves the supplier bid form, increasing the revision only on a real change', async () => {
    const id = await acceptedTender();
    const parts = (customFields: object[]) => [
      { partType: 'legal_information', customFields: [] },
      { partType: 'technical_offer', customFields },
      { partType: 'financial_offer', customFields: [] },
    ];
    const ram = {
      type: 'number',
      required: true,
      unit: 'GB',
      minimum: 16,
      translations: [{ language: 'en', label: 'Memory per laptop' }],
    };

    const saved = await officer.put(`${MANAGE}/${id}/bid-form`, {
      revision: 2,
      parts: parts([ram]),
    });
    expect(saved.status).toBe(200);
    expect(saved.body.revision).toBe(3);
    const technical = (saved.body.parts as { partType: string; customFields: object[] }[]).find(
      (p) => p.partType === 'technical_offer',
    );
    expect(technical?.customFields).toEqual([
      expect.objectContaining({ type: 'number', unit: 'GB', minimum: 16 }),
    ]);
    const fieldId = (technical?.customFields[0] as { fieldId: string }).fieldId;

    // The same template again: no change, no new revision.
    const same = await officer.put(`${MANAGE}/${id}/bid-form`, {
      revision: 3,
      parts: parts([{ ...ram, fieldId }]),
    });
    expect(same.body.revision).toBe(3);

    // A unit on a text field, and an unknown field id, are refused.
    const invalid = await officer.put(`${MANAGE}/${id}/bid-form`, {
      revision: 3,
      parts: parts([
        { ...ram, type: 'text' },
        { ...ram, fieldId: '00000000-0000-4000-8000-000000000000' },
      ]),
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.fields).toEqual(
      expect.arrayContaining([
        { field: 'parts[1].customFields[0].type', code: 'INVALID' },
        { field: 'parts[1].customFields[1].fieldId', code: 'INVALID' },
      ]),
    );
  });

  it('publishes with valid deadlines, then locks the tender', async () => {
    const id = await acceptedTender();

    const outOfOrder = await officer.send('post', `${MANAGE}/${id}/publish`, {
      revision: 2,
      categoryCode: category,
      deadlines: { ...deadlines, technical: future(30) },
    });
    expect(outOfOrder.body.error.fields).toEqual([
      { field: 'deadlines', code: 'DEADLINES_OUT_OF_ORDER' },
    ]);

    const inPast = await officer.send('post', `${MANAGE}/${id}/publish`, {
      revision: 2,
      categoryCode: category,
      deadlines: { ...deadlines, application: future(-1) },
    });
    expect(inPast.body.error.fields).toEqual([
      { field: 'deadlines.application', code: 'DEADLINE_IN_PAST' },
    ]);

    const published = await officer.send('post', `${MANAGE}/${id}/publish`, {
      revision: 2,
      categoryCode: category,
      deadlines,
    });
    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({ status: 'published', revision: 3 });
    expect(
      await prisma.auditEvent.count({ where: { action: 'tender.published', resourceId: id } }),
    ).toBe(1);

    // Everything is read-only from here on.
    const edit = await officer.send('patch', `${MANAGE}/${id}`, {
      revision: 3,
      categoryCode: category,
    });
    const upload = await uploadToR(id, 3);
    const form = await officer.put(`${MANAGE}/${id}/bid-form`, { revision: 3, parts: [] });
    for (const response of [edit, upload, form]) {
      expect(response.status).toBe(409);
      expect(response.body.error).toMatchObject({
        code: 'TENDER_STATUS_CHANGED',
        details: { currentStatus: 'published' },
      });
    }
  });

  it.each(['en', 'ar'] as const)('completes the S1 publishing path in %s', async (language) => {
    const title = language === 'ar' ? 'صيانة المدرسة' : 'School maintenance';
    const description = language === 'ar' ? 'إصلاح السقف.' : 'Repair the roof.';
    const created = await employee.send('post', '/api/v1/employee/tenders', {
      categoryCode: category,
      estimatedBalance: { amount: '125000.00', currency: 'USD' },
      translations: [{ language, title, description }],
    });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    const own = await employee.get(`/api/v1/employee/tenders/${id}`);
    expect(own.body.status).toBe('draft');
    const edited = await employee.send('patch', `/api/v1/employee/tenders/${id}`, {
      revision: created.body.revision,
      translations: [{ language, title, description: description + ' ' + description }],
    });
    expect(edited.status).toBe(200);
    const accepted = await officer.send('post', `${MANAGE}/${id}/accept`, {
      revision: edited.body.revision,
      technicalWeight: 70,
      financialWeight: 30,
      minimumTechnicalScore: 60,
    });
    expect(accepted.status).toBe(200);
    const uploaded = await uploadToR(id, accepted.body.revision as number, { language });
    expect(uploaded.status).toBe(201);
    const template = await officer.put(`${MANAGE}/${id}/bid-form`, {
      revision: uploaded.body.revision,
      parts: [
        { partType: 'legal_information', customFields: [] },
        {
          partType: 'technical_offer',
          customFields: [
            {
              type: 'number',
              required: true,
              unit: 'GB',
              minimum: 16,
              translations: [{ language, label: language === 'ar' ? 'الذاكرة' : 'Memory' }],
            },
          ],
        },
        { partType: 'financial_offer', customFields: [] },
      ],
    });
    expect(template.status).toBe(200);
    const published = await officer.send('post', `${MANAGE}/${id}/publish`, {
      revision: template.body.revision,
      categoryCode: category,
      deadlines,
    });
    expect(published.status).toBe(200);
    const visible = await request(app.getHttpServer())
      .get(`/api/v1/tenders/${id}`)
      .set('Accept-Language', language);
    expect(visible.status).toBe(200);
    expect(visible.headers['content-language']).toBe(language);
    expect(visible.body).toMatchObject({
      status: 'published',
      content: { language, title },
      isFallback: false,
    });
    for (const key of ['estimatedBalance', 'scoring', 'requestedBy', 'revision'])
      expect(visible.body).not.toHaveProperty(key);
    const link = await request(app.getHttpServer()).get(
      `/api/v1/tenders/${id}/documents/${uploaded.body.document.id}/download`,
    );
    expect(link.status).toBe(200);
    expect((await request(app.getHttpServer()).get(link.body.url as string)).status).toBe(200);
    expect(
      (
        await employee.send('patch', `/api/v1/employee/tenders/${id}`, {
          revision: published.body.revision,
        })
      ).body.error.code,
    ).toBe('TENDER_STATUS_CHANGED');
  });

  it('copies a cancelled tender once, with its scoring, files, and bid form', async () => {
    const id = await acceptedTender();
    await uploadToR(id, 2);
    await officer.put(`${MANAGE}/${id}/bid-form`, {
      revision: 3,
      parts: [
        { partType: 'legal_information', customFields: [] },
        {
          partType: 'technical_offer',
          customFields: [
            { type: 'text', required: false, translations: [{ language: 'en', label: 'Notes' }] },
          ],
        },
        { partType: 'financial_offer', customFields: [] },
      ],
    });
    await prisma.tender.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancellationReason: 'no_bids',
        cancelledAt: new Date(),
        applicationDeadline: new Date(deadlines.application),
        technicalDeadline: new Date(deadlines.technical),
        financialDeadline: new Date(deadlines.financial),
      },
    });

    const copied = await officer.send('post', `${MANAGE}/${id}/copy`);
    expect(copied.status).toBe(201);
    expect(copied.body).toMatchObject({ status: 'accepted', revision: 1, copiedFromTenderId: id });

    const copy = await officer.get(`${MANAGE}/${copied.body.id}`);
    expect(copy.body).toMatchObject({
      deadlines: null,
      scoring: { technicalWeight: 70 },
      documents: [expect.objectContaining({ name: 'ToR.pdf' })],
    });
    const form = await officer.get(`${MANAGE}/${copied.body.id}/bid-form`);
    const technical = (form.body.parts as { partType: string; customFields: unknown[] }[]).find(
      (p) => p.partType === 'technical_offer',
    );
    expect(technical?.customFields).toHaveLength(1);

    const again = await officer.send('post', `${MANAGE}/${id}/copy`);
    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({
      code: 'TENDER_ALREADY_COPIED',
      details: { copyId: copied.body.id },
    });

    const notCancelled = await officer.send('post', `${MANAGE}/${copied.body.id}/copy`);
    expect(notCancelled.body.error.code).toBe('TENDER_NOT_CANCELLED');
  });
});
