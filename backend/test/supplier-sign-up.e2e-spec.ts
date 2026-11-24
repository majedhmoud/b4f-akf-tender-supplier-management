import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { access, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { VISITOR_COOKIE } from '../src/auth/auth.settings.js';
import type { Role } from '../src/generated/prisma/client.js';
import { IdempotencyService } from '../src/idempotency/idempotency.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FileStorage } from '../src/storage/file-storage.js';
import { TestClient } from './support/test-client.js';
import { uniqueRunId } from './support/run-id.js';

// R2/U1–U6. U7 and account setup are in account-setup.e2e-spec.ts.
process.env.COOKIE_SECURE = 'false';
process.env.SIGN_IN_RATE_LIMIT = '1000';
process.env.FILE_STORAGE_DIR = `storage-test-signup-${process.pid}`;
const PDF = Buffer.from('%PDF-1.7\nRegistration certificate');
const ROOT = '/api/v1/supplier-applications';
const ROUTE = 'POST /api/v1/supplier-applications';
const PASSWORD = 'correct horse battery staple';

// These tests submit far more applications than the real per-IP limit allows.
process.env.APPLICATION_RATE_LIMIT = '1000';

describe('Supplier applications and legal review (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let storage: FileStorage;
  let idempotency: IdempotencyService;
  let legal: TestClient;
  let admin: TestClient;
  let employee: TestClient;
  let officer: TestClient;
  const runId = uniqueRunId();
  const users: string[] = [];
  const scopes: string[] = [];
  const domain = `@${runId}.test`;
  let number = 0;

  const data = (extra: object = {}) => ({
    legalName: 'Al-Noor Engineering',
    registrationNumber: `CR-${runId}-${++number}`,
    contactEmail: `supplier-${number}${domain}`,
    preferredLanguage: 'ar',
    ...extra,
  });
  const cookies = (client: TestClient) =>
    [...client.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  async function guest() {
    const client = new TestClient(app.getHttpServer());
    await client.fetchCsrf();
    scopes.push(client.cookies.get(VISITOR_COOKIE)!.split('.')[0]);
    return client;
  }
  function submit(
    client: TestClient,
    dto: object,
    key: string | undefined = randomUUID(),
    options: {
      file?: Buffer;
      omitTax?: boolean;
      noCsrf?: boolean;
      extra?: Record<string, string>;
    } = {},
  ) {
    let req = request(app.getHttpServer()).post(ROOT).set('Cookie', cookies(client));
    if (!options.noCsrf) req = req.set('X-CSRF-Token', client.csrfToken);
    if (key) req = req.set('Idempotency-Key', key);
    req = req
      .field('application', JSON.stringify(dto))
      .field('languages[registration_certificate]', 'ar')
      .field('languages[tax_certificate]', 'en');
    for (const [key, value] of Object.entries(options.extra ?? {})) req = req.field(key, value);
    req = req.attach('files[registration_certificate]', options.file ?? PDF, {
      filename: 'register.pdf',
      contentType: 'application/pdf',
    });
    if (!options.omitTax)
      req = req.attach('files[tax_certificate]', PDF, {
        filename: 'tax.pdf',
        contentType: 'application/pdf',
      });
    return req;
  }
  async function create(client?: TestClient) {
    const response = await submit(client ?? (await guest()), data());
    expect(response.status).toBe(201);
    return response.body.applicationId as string;
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
    users.push(row.id);
    const client = new TestClient(app.getHttpServer());
    await client.signIn(row.email, PASSWORD);
    return client;
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(FileStorage);
    idempotency = app.get(IdempotencyService);
    legal = await signedIn('legal_committee');
    admin = await signedIn('admin');
    employee = await signedIn('employee');
    officer = await signedIn('procurement_officer');
  });
  afterAll(async () => {
    const applications = await prisma.supplierApplication.findMany({
      where: { contactEmail: { endsWith: domain } },
      select: { id: true },
    });
    const ids = applications.map((row) => row.id);
    await prisma.auditEvent.deleteMany({
      where: { OR: [{ actorUserId: { in: users } }, { resourceId: { in: ids } }] },
    });
    await prisma.supplier.deleteMany({ where: { applicationId: { in: ids } } });
    await prisma.signupReview.deleteMany({ where: { applicationId: { in: ids } } });
    await prisma.document.deleteMany({
      where: {
        OR: [
          { applicationLink: { applicationId: { in: ids } } },
          { uploadedByUserId: { in: users } },
        ],
      },
    });
    await prisma.supplierApplication.deleteMany({ where: { id: { in: ids } } });
    if (scopes.length)
      await prisma.$executeRaw`DELETE FROM idempotency_keys WHERE guest_scope_id=ANY(${scopes}::uuid[])`;
    await prisma.userAccount.deleteMany({ where: { id: { in: users } } });
    await app.close();
    await rm(process.env.FILE_STORAGE_DIR!, { recursive: true, force: true });
  });

  it('returns the fixed public form with both required certificates', async () => {
    const result = await request(app.getHttpServer()).get(
      '/api/v1/reference/forms/supplier-application',
    );
    expect(result.status).toBe(200);
    expect(result.headers['cache-control']).toBe('public, max-age=60');
    expect((result.body.fields as { name: string }[]).map((f) => f.name)).toEqual([
      'legalName',
      'registrationNumber',
      'contactEmail',
      'preferredLanguage',
    ]);
    expect(result.body.documents).toEqual([
      { kind: 'registration_certificate', required: true },
      { kind: 'tax_certificate', required: true },
    ]);
  });
  it('submits legal data and private files atomically without creating an account', async () => {
    const client = await guest();
    const dto = data();
    const result = await submit(client, dto);
    expect(result.status).toBe(201);
    expect(result.headers['cache-control']).toBe('private, no-store');
    const row = await prisma.supplierApplication.findUniqueOrThrow({
      where: { id: result.body.applicationId },
      include: { documents: { include: { document: true } } },
    });
    expect(row.documents).toHaveLength(2);
    expect(
      row.documents.every(
        (link) =>
          link.document.uploadedByUserId === null && link.document.ownerType === 'application',
      ),
    ).toBe(true);
    expect(await prisma.userAccount.count({ where: { email: dto.contactEmail } })).toBe(0);
    expect(
      await prisma.auditEvent.count({
        where: { resourceId: row.id, action: 'supplier_application.submitted' },
      }),
    ).toBe(1);
    const detail = await legal.get(`${ROOT}/${row.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body).not.toHaveProperty('storageKey');
    expect(JSON.stringify(detail.body)).not.toMatch(/storageKey|token|password/);
  });
  it('replays one submission after CSRF renewal, independent of JSON property order', async () => {
    const client = await guest();
    const dto = data();
    const key = randomUUID();
    const original = await submit(client, dto, key);
    await client.fetchCsrf();
    const reversed = Object.fromEntries(Object.entries(dto).reverse());
    const replay = await submit(client, reversed, key);
    expect(replay.status).toBe(201);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body).toEqual(original.body);
    expect(
      await prisma.supplierApplication.count({
        where: { registrationNumber: dto.registrationNumber },
      }),
    ).toBe(1);
  });
  it('isolates the same key between guest browsers', async () => {
    const key = randomUUID();
    const first = await submit(await guest(), data(), key);
    const second = await submit(await guest(), data(), key);
    expect(second.status).toBe(201);
    expect(second.body.applicationId).not.toBe(first.body.applicationId);
  });
  it('rejects key reuse for changed fields or file bytes', async () => {
    const client = await guest();
    const dto = data();
    const key = randomUUID();
    await submit(client, dto, key);
    for (const result of [
      await submit(client, { ...dto, legalName: 'Changed' }, key),
      await submit(client, dto, key, { file: Buffer.from('%PDF-1.7\nDifferent file') }),
    ]) {
      expect(result.status).toBe(422);
      expect(result.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    }
  });
  it('refuses missing CSRF, signed-in applicants, missing files and account fields', async () => {
    const client = await guest();
    expect((await submit(client, data(), undefined, { noCsrf: true })).status).toBe(403);
    expect((await submit(employee, data())).status).toBe(404);
    const missing = await submit(client, data(), randomUUID(), { omitTax: true });
    expect(missing.status).toBe(400);
    const extra = await submit(client, data({ role: 'admin', password: 'not-allowed' }));
    expect(extra.status).toBe(400);
    expect(extra.body.error.code).toBe('VALIDATION_FAILED');
  });
  it('does not write rows for invalid files or a missing idempotency key', async () => {
    const client = await guest();
    const dto = data();
    expect(
      (await submit(client, dto, randomUUID(), { file: Buffer.from('MZ executable') })).status,
    ).toBe(415);
    expect((await submit(client, dto, '')).status).toBe(400);
    expect(
      await prisma.supplierApplication.count({
        where: { registrationNumber: dto.registrationNumber },
      }),
    ).toBe(0);
  });
  it('rejects a caller-chosen browser scope at CSRF bootstrap', async () => {
    const client = await guest();
    const forged = randomUUID();
    client.cookies.set(VISITOR_COOKIE, forged);
    await client.fetchCsrf();
    const issued = client.cookies.get(VISITOR_COOKIE)!;
    expect(issued).not.toBe(forged);
    expect(issued.split('.')[0]).not.toBe(forged);
    scopes.push(issued.split('.')[0]);
    const altered = issued + '.';
    client.cookies.set(VISITOR_COOKIE, altered);
    await client.fetchCsrf();
    expect(client.cookies.get(VISITOR_COOKIE)).not.toBe(altered);
    scopes.push(client.cookies.get(VISITOR_COOKIE)!.split('.')[0]);
    expect((await submit(client, data())).status).toBe(201);
  });
  it('lists pending applications with pagination and serves only their own files', async () => {
    const id = await create();
    const otherId = await create();
    const queue = await legal.get('/api/v1/signup-reviews?status=pending&limit=1');
    expect(queue.status).toBe(200);
    expect(queue.body.data).toHaveLength(1);
    expect(queue.body.meta.limit).toBe(1);
    expect(Object.keys((queue.body.data as object[])[0]).sort()).toEqual(
      ['applicationId', 'legalName', 'registrationNumber', 'submittedAt'].sort(),
    );
    const detail = await legal.get(`${ROOT}/${id}`);
    const docId = detail.body.documents[0].id;
    const link = await legal.get(`${ROOT}/${id}/documents/${docId}/download`);
    expect(link.status).toBe(200);
    expect(link.headers['cache-control']).toBe('private, no-store');
    const file = await request(app.getHttpServer()).get(link.body.url as string);
    expect(file.status).toBe(200);
    expect(file.headers['cache-control']).toBe('private, no-store');
    expect((await legal.get(`${ROOT}/${otherId}/documents/${docId}/download`)).status).toBe(404);
    expect((await admin.get(`${ROOT}/${id}/documents/${docId}/download`)).status).toBe(404);
  });
  it('accepts once, raises for admin, and returns a separate admin view', async () => {
    const id = await create();
    const result = await legal.send('post', `${ROOT}/${id}/review`, {
      decision: 'accepted',
      reason: null,
    });
    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({
      decision: 'accepted',
      raisedToAdminAt: expect.any(String),
    });
    const duplicate = await legal.send('post', `${ROOT}/${id}/review`, {
      decision: 'rejected',
      extra: 'ignored-after-decision',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.details.decision).toBe('accepted');
    const queue = await admin.get('/api/v1/signup-requests?status=raised&limit=100');
    expect(
      (queue.body.data as { applicationId: string }[]).some((row) => row.applicationId === id),
    ).toBe(true);
    const detail = await admin.get(`/api/v1/signup-requests/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.review.decision).toBe('accepted');
    expect(detail.body).not.toHaveProperty('documents');
    expect(
      await prisma.auditEvent.count({ where: { resourceId: id, action: 'signup_review.decided' } }),
    ).toBe(1);
  });
  it('rejects once without raising, provisioning or changing the original application', async () => {
    const id = await create();
    const before = await prisma.supplierApplication.findUniqueOrThrow({ where: { id } });
    const result = await legal.send('post', `${ROOT}/${id}/review`, {
      decision: 'rejected',
      reason: 'Invalid registration',
    });
    expect(result.status).toBe(201);
    expect(result.body.raisedToAdminAt).toBeNull();
    expect((await admin.get(`/api/v1/signup-requests/${id}`)).status).toBe(404);
    expect(await prisma.supplier.count({ where: { applicationId: id } })).toBe(0);
    expect(await prisma.supplierApplication.findUnique({ where: { id } })).toEqual(before);
  });
  it('refuses a sign-up whose email already has an account, in any letter case', async () => {
    // The legal reviewer's own account email, typed in capitals.
    const taken = `LEGAL_COMMITTEE${domain}`.toUpperCase();
    const response = await submit(await guest(), data({ contactEmail: taken }));

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      code: 'EMAIL_ALREADY_REGISTERED',
      fields: [{ field: 'contactEmail', code: 'EMAIL_ALREADY_REGISTERED' }],
    });
    expect(
      await prisma.supplierApplication.count({ where: { contactEmail: taken.toLowerCase() } }),
    ).toBe(0);
  });

  it('limits field lengths and stores the contact email in lower case', async () => {
    const tooLong = await submit(
      await guest(),
      data({ registrationNumber: 'R'.repeat(101), contactEmail: `${'a'.repeat(250)}@x.test` }),
    );
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.fields).toEqual(
      expect.arrayContaining([
        { field: 'registrationNumber', code: 'INVALID' },
        { field: 'contactEmail', code: 'INVALID' },
      ]),
    );

    const id = (
      await submit(await guest(), data({ contactEmail: `  Mixed.Case-${runId}${domain}  ` }))
    ).body.applicationId as string;
    const stored = await prisma.supplierApplication.findUniqueOrThrow({ where: { id } });
    expect(stored.contactEmail).toBe(`mixed.case-${runId}${domain}`.toLowerCase());

    const longReason = await legal.send('post', `${ROOT}/${id}/review`, {
      decision: 'rejected',
      reason: 'x'.repeat(2001),
    });
    expect(longReason.status).toBe(400);
    expect(longReason.body.error.fields).toEqual([{ field: 'reason', code: 'INVALID' }]);
  });

  it('serializes concurrent legal decisions and keeps exactly one review/audit event', async () => {
    const id = await create();
    const results = await Promise.all([
      legal.send('post', `${ROOT}/${id}/review`, { decision: 'accepted' }),
      legal.send('post', `${ROOT}/${id}/review`, { decision: 'rejected' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.signupReview.count({ where: { applicationId: id } })).toBe(1);
    expect(
      await prisma.auditEvent.count({ where: { resourceId: id, action: 'signup_review.decided' } }),
    ).toBe(1);
  });
  it('denies other roles, pending admin requests, and legal tender access with 404', async () => {
    const id = await create();
    for (const client of [employee, officer, admin])
      expect((await client.get(`${ROOT}/${id}`)).status).toBe(404);
    expect((await admin.get(`/api/v1/signup-requests/${id}`)).status).toBe(404);
    expect((await legal.get('/api/v1/manage/tenders')).status).toBe(404);
    expect((await legal.get(`/api/v1/signup-requests/${id}`)).status).toBe(404);
    expect((await legal.get(`${ROOT}/${randomUUID()}`)).status).toBe(404);
  });
  it('checks already-registered numbers without implementing account provisioning', async () => {
    const id = await create();
    const existing = await prisma.supplierApplication.findUniqueOrThrow({ where: { id } });
    await prisma.supplier.create({
      data: {
        applicationId: id,
        userId: users[2],
        legalName: existing.legalName,
        registrationNumber: existing.registrationNumber,
      },
    });
    const result = await submit(
      await guest(),
      data({ registrationNumber: existing.registrationNumber }),
    );
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('REGISTRATION_NUMBER_EXISTS');
  });
  it('rolls back files, the application and its reservation when a write fails', async () => {
    const client = await guest();
    const dto = data();
    const key = randomUUID();
    const save = storage.save.bind(storage);
    let count = 0;
    const savedKeys: string[] = [];
    const spy = vi.spyOn(storage, 'save').mockImplementation(async (content) => {
      if (++count === 2) throw new Error('simulated disk failure');
      const key = await save(content);
      savedKeys.push(key);
      return key;
    });
    try {
      expect((await submit(client, dto, key)).status).toBe(500);
    } finally {
      spy.mockRestore();
    }
    expect(
      await prisma.supplierApplication.count({
        where: { registrationNumber: dto.registrationNumber },
      }),
    ).toBe(0);
    expect(savedKeys).toHaveLength(1);
    await expect(
      access(resolve(process.env.FILE_STORAGE_DIR!, savedKeys[0])),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await submit(client, dto, key)).status).toBe(201);
  });
  it('returns in-progress for an active reservation and commits a single replayable result', async () => {
    const scope = randomUUID();
    scopes.push(scope);
    const key = randomUUID();
    let release!: () => void;
    let entered!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const first = idempotency.guest(scope, key, ROUTE, 'hash', async () => {
      entered();
      await hold;
      return { applicationId: 'test' };
    });
    await started;
    try {
      await expect(
        idempotency.guest(scope, key, ROUTE, 'hash', () =>
          Promise.resolve({ applicationId: 'wrong' }),
        ),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_IN_PROGRESS' });
    } finally {
      release();
    }
    await first;
    expect(
      (
        await idempotency.guest(scope, key, ROUTE, 'hash', () =>
          Promise.resolve({ applicationId: 'wrong' }),
        )
      ).body,
    ).toEqual({ applicationId: 'test' });
  });
  it('reclaims an expired abandoned reservation', async () => {
    const scope = randomUUID();
    scopes.push(scope);
    const key = randomUUID();
    await prisma.$executeRaw`INSERT INTO idempotency_keys(guest_scope_id,route,key,payload_hash,expires_at) VALUES(${scope}::uuid,${ROUTE},${key}::uuid,'old',NOW()-INTERVAL '25 hours')`;
    const result = await idempotency.guest(scope, key, ROUTE, 'new', () =>
      Promise.resolve({ applicationId: 'recovered' }),
    );
    expect(result.body.applicationId).toBe('recovered');
  });
  it('reclaims a reservation abandoned by a crashed worker, after 60 seconds', async () => {
    const scope = randomUUID();
    scopes.push(scope);
    const key = randomUUID();
    // Reserved two minutes ago, never completed, and no transaction holds it.
    await prisma.$executeRaw`INSERT INTO idempotency_keys(guest_scope_id,route,key,payload_hash,expires_at) VALUES(${scope}::uuid,${ROUTE},${key}::uuid,'hash',NOW()+INTERVAL '24 hours'-INTERVAL '2 minutes')`;

    const result = await idempotency.guest(scope, key, ROUTE, 'hash', () =>
      Promise.resolve({ applicationId: 'recovered-after-crash' }),
    );

    expect(result).toEqual({ body: { applicationId: 'recovered-after-crash' }, replayed: false });
  });

  it('never reclaims an old reservation that a live transaction still holds', async () => {
    const scope = randomUUID();
    scopes.push(scope);
    const key = randomUUID();
    await prisma.$executeRaw`INSERT INTO idempotency_keys(guest_scope_id,route,key,payload_hash,expires_at) VALUES(${scope}::uuid,${ROUTE},${key}::uuid,'hash',NOW()+INTERVAL '24 hours'-INTERVAL '2 minutes')`;
    let release!: () => void;
    let locked!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const isLocked = new Promise<void>((resolve) => {
      locked = resolve;
    });
    // A slow worker holding the reservation row, as a real one does.
    const worker = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT key FROM idempotency_keys WHERE guest_scope_id=${scope}::uuid AND key=${key}::uuid FOR UPDATE`;
      locked();
      await hold;
    });
    await isLocked;
    try {
      await expect(
        idempotency.guest(scope, key, ROUTE, 'hash', () =>
          Promise.resolve({ applicationId: 'must-not-run' }),
        ),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_IN_PROGRESS' });
    } finally {
      release();
      await worker;
    }
  });

  it('enforces owner and review-state database constraints', async () => {
    const id = await create();
    await expect(
      prisma.signupReview.create({
        data: {
          applicationId: id,
          reviewerUserId: users[0],
          decision: 'rejected',
          raisedToAdminAt: new Date(),
        },
      }),
    ).rejects.toThrow(/signup_reviews_raised_check/);
    await expect(
      prisma.$executeRaw`INSERT INTO idempotency_keys(user_id,guest_scope_id,route,key,payload_hash,expires_at) VALUES(${users[0]}::uuid,${randomUUID()}::uuid,'invalid',${randomUUID()}::uuid,'hash',NOW())`,
    ).rejects.toThrow(/idempotency_keys_owner_check/);
  });
});
