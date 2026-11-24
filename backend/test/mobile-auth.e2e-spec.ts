import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { MobileSupplierBid } from '../src/bids/dto/bid.dto.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TestClient } from './support/test-client.js';
import { uniqueRunId } from './support/run-id.js';

// Protects the mobile session channel and the read-only supplier scope (API contract §1.9).
process.env.COOKIE_SECURE = 'false';
process.env.SIGN_IN_RATE_LIMIT = '1000';

const password = 'mobile fixture password';
const mobileAuth = '/api/v1/mobile/auth';
const myBids = '/api/v1/me/bids';

describe('Mobile supplier sessions (e2e)', () => {
  const runId = uniqueRunId();
  const categoryCode = `mobile-${runId}`;
  const email = (label: string) => `${label}-${runId}@test.local`;
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownBidId: string;
  let otherBidId: string;
  let tenderId: string;

  const http = () => request(app.getHttpServer());
  const signIn = (label = 'supplier') =>
    http()
      .post(`${mobileAuth}/sign-in`)
      .send({ email: email(label), password });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const passwordHash = await bcrypt.hash(password, 4);
    const staff = await prisma.userAccount.create({
      data: {
        email: email('staff'),
        displayName: 'Mobile test employee',
        preferredLanguage: 'en',
        status: 'active',
        passwordHash,
        roles: { create: { role: 'employee' } },
      },
    });
    const createSupplier = (label: string) => {
      const name = `Mobile test ${label}`;
      const registrationNumber = `${label}-${runId}`;
      return prisma.supplier.create({
        data: {
          legalName: name,
          registrationNumber,
          application: {
            create: {
              legalName: name,
              registrationNumber,
              contactEmail: email(label),
              preferredLanguage: 'en',
            },
          },
          user: {
            create: {
              email: email(label),
              displayName: name,
              preferredLanguage: 'en',
              status: 'active',
              passwordHash,
              roles: { create: { role: 'supplier' } },
            },
          },
        },
      });
    };
    const [supplier, other] = await Promise.all([
      createSupplier('supplier'),
      createSupplier('other'),
    ]);
    await prisma.tenderCategory.create({ data: { code: categoryCode } });
    const now = Date.now();
    const tender = await prisma.tender.create({
      data: {
        status: 'published',
        requestedByUserId: staff.id,
        categoryCode,
        estimatedBalance: 1000,
        currencyCode: 'USD',
        acceptedAt: new Date(now),
        publishedAt: new Date(now),
        applicationDeadline: new Date(now + 86_400_000),
        technicalDeadline: new Date(now + 172_800_000),
        financialDeadline: new Date(now + 259_200_000),
        translations: {
          create: { language: 'en', title: 'Supplier mobile test tender', description: 'Test' },
        },
      },
    });
    tenderId = tender.id;
    const [own, foreign] = await Promise.all([
      prisma.bid.create({ data: { tenderId, supplierId: supplier.id, bidderCode: 'A' } }),
      prisma.bid.create({ data: { tenderId, supplierId: other.id, bidderCode: 'B' } }),
    ]);
    ownBidId = own.id;
    otherBidId = foreign.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      const emails = [email('supplier'), email('other'), email('staff')];
      if (tenderId) {
        await prisma.bid.deleteMany({ where: { tenderId } });
        await prisma.tender.delete({ where: { id: tenderId } });
      }
      await prisma.tenderCategory.deleteMany({ where: { code: categoryCode } });
      await prisma.supplier.deleteMany({ where: { user: { email: { in: emails } } } });
      await prisma.supplierApplication.deleteMany({ where: { contactEmail: { in: emails } } });
      await prisma.userAccount.deleteMany({ where: { email: { in: emails } } });
    } finally {
      await app.close();
    }
  });

  it('requires JSON and only issues sessions to suppliers', async () => {
    const staff = await signIn('staff');
    expect(staff.status).toBe(401);
    expect(staff.body.error.code).toBe('INVALID_CREDENTIALS');
    await http()
      .post(`${mobileAuth}/sign-in`)
      .type('form')
      .send({ email: email('supplier'), password })
      .expect(400);
  });

  it('limits mobile tokens to owned bid reads and returns only tracking fields', async () => {
    const session = await signIn().expect(200);
    expect(session.headers['set-cookie']).toBeUndefined();
    expect(session.headers['cache-control']).toBe('private, no-store');
    const token = session.body.accessToken as string;
    const bearer = `Bearer ${token}`;
    const list = await http().get(myBids).set('Authorization', bearer).expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].bidId).toBe(ownBidId);
    const detail = await http()
      .get(`${myBids}/${ownBidId}`)
      .set('Authorization', bearer)
      .expect(200);
    const bid = detail.body as MobileSupplierBid;
    expect(Object.keys(bid).sort()).toEqual(['id', 'parts', 'serverTime', 'tender']);
    expect(bid.parts).toHaveLength(3);
    expect(Object.keys(bid.parts[0]).sort()).toEqual(['deadline', 'locked', 'partType']);
    await http().get(`${myBids}/${otherBidId}`).set('Authorization', bearer).expect(404);
    await http().get('/api/v1/employee/tenders').set('Authorization', bearer).expect(401);
    await http()
      .put(`${myBids}/${ownBidId}/parts/technical_offer`)
      .set('Authorization', bearer)
      .expect(401);
    await http().get(myBids).set('Cookie', `access_token=${token}`).expect(401);
  });

  it('rotates refresh tokens, revokes on reuse and leaves web sessions separate', async () => {
    const web = new TestClient(app.getHttpServer());
    await web.signIn(email('supplier'), password);
    const webRefresh = web.cookies.get('refresh_token');
    expect(webRefresh).toEqual(expect.any(String));
    await http().post(`${mobileAuth}/refresh`).send({ refreshToken: webRefresh }).expect(401);
    await http().post(`${mobileAuth}/sign-out`).send({ refreshToken: webRefresh }).expect(204);
    const webDetail = await web.get(`${myBids}/${ownBidId}`);
    expect(webDetail.status).toBe(200);
    expect(webDetail.body).toHaveProperty('legalInformation');

    const session = await signIn().expect(200);
    const refreshToken = session.body.refreshToken as string;
    const refreshed = await http().post(`${mobileAuth}/refresh`).send({ refreshToken }).expect(200);
    expect(refreshed.body.refreshToken).not.toBe(refreshToken);
    const replay = await http().post(`${mobileAuth}/refresh`).send({ refreshToken }).expect(401);
    expect(replay.body.error.code).toBe('SESSION_REVOKED');
    const revoked = await http()
      .get(myBids)
      .set('Authorization', `Bearer ${refreshed.body.accessToken as string}`)
      .expect(401);
    expect(revoked.body.error.code).toBe('SESSION_REVOKED');
  });

  it('revokes the mobile session on sign-out', async () => {
    const session = await signIn().expect(200);
    const refreshToken = session.body.refreshToken as string;
    const accessToken = session.body.accessToken as string;
    await http().post(`${mobileAuth}/sign-out`).send({ refreshToken }).expect(204);
    await http().get(myBids).set('Authorization', `Bearer ${accessToken}`).expect(401);
    await http().post(`${mobileAuth}/refresh`).send({ refreshToken }).expect(401);
  });
});
