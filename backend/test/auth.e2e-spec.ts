import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TestClient } from './support/test-client.js';
import { uniqueRunId } from './support/run-id.js';

// Pins staff sign-in as API_CONTRACT.md §1.1 and the Auth payloads describe it:
// CSRF on every POST, the error codes the web app reacts to, refresh rotation
// with reuse detection, and sign-out stopping the session at once.
// Runs against the local database with run-unique accounts (CODING_STANDARDS.md §2.7).

// Supertest does not send Secure cookies over http, and these tests sign in
// more often than the real per-IP limit allows.
process.env.COOKIE_SECURE = 'false';
process.env.SIGN_IN_RATE_LIMIT = '1000';

const PASSWORD = 'correct horse battery staple';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runId = uniqueRunId();
  const email = (label: string) => `${label}-${runId}@test.local`;
  const userIds: string[] = [];

  async function createUser(label: string, status: 'active' | 'pending_setup' | 'disabled') {
    const user = await prisma.userAccount.create({
      data: {
        email: email(label),
        displayName: `Test ${label}`,
        preferredLanguage: 'en',
        status,
        passwordHash: status === 'pending_setup' ? null : await bcrypt.hash(PASSWORD, 4),
        roles: { create: { role: 'employee' } },
      },
    });
    userIds.push(user.id);
    return user;
  }

  const client = () => new TestClient(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await createUser('active', 'active');
    await createUser('pending', 'pending_setup');
    await createUser('disabled', 'disabled');
  });

  afterAll(async () => {
    await prisma.userAccount.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('issues a CSRF token with the server time, and a visitor cookie', async () => {
    const c = client();
    const response = await c.fetchCsrf();

    expect(response.status).toBe(200);
    expect(c.csrfToken).toEqual(expect.any(String));
    expect(response.body.serverTime).toMatch(/Z$/);
    expect(c.cookies.has('visitor_id')).toBe(true);
  });

  it('refuses a POST without a valid CSRF token', async () => {
    const c = client();
    await c.fetchCsrf();
    const response = await c.send(
      'post',
      '/api/v1/auth/sign-in',
      { email: email('active'), password: PASSWORD },
      false,
    );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('answers a wrong password and an unknown email the same way, in the error envelope', async () => {
    const wrongPassword = await client().signIn(email('active'), 'wrong password');
    const unknownEmail = await client().signIn(email('nobody'), PASSWORD);

    for (const response of [wrongPassword, unknownEmail]) {
      expect(response.status).toBe(401);
      expect(response.body.error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        requestId: expect.stringMatching(/^req_/),
      });
    }
  });

  it('tells an account without a password to use its setup link', async () => {
    const response = await client().signIn(email('pending'), PASSWORD);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_PENDING_SETUP');
  });

  it('blocks a disabled account even with the right password', async () => {
    const response = await client().signIn(email('disabled'), PASSWORD);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('reports invalid and extra fields as VALIDATION_FAILED', async () => {
    const c = client();
    await c.fetchCsrf();
    const response = await c.send('post', '/api/v1/auth/sign-in', {
      password: PASSWORD,
      role: 'admin',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.fields).toEqual(
      expect.arrayContaining([
        { field: 'email', code: 'REQUIRED' },
        { field: 'role', code: 'FIELD_NOT_EDITABLE' },
      ]),
    );
  });

  it('signs in with HttpOnly cookies and returns the session', async () => {
    const c = client();
    const response = await c.signIn(email('active'), PASSWORD);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      user: {
        email: email('active'),
        displayName: 'Test active',
        preferredLanguage: 'en',
        roles: ['employee'],
      },
      supplier: null,
    });
    const setCookie = (response.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(setCookie).toMatch(/access_token=.*HttpOnly/);
    expect(setCookie).toMatch(/refresh_token=.*Path=\/api\/v1\/auth.*HttpOnly/);

    const session = await c.get('/api/v1/auth/session');
    expect(session.status).toBe(200);
    expect(session.body.user).toMatchObject({ email: email('active'), displayName: 'Test active' });
  });

  it('requires a session for protected endpoints', async () => {
    const response = await client().get('/api/v1/auth/session');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('answers an expired access token with SESSION_EXPIRED, so the app refreshes', async () => {
    const c = client();
    await c.signIn(email('active'), PASSWORD);
    const valid = c.cookies.get('access_token') ?? '';
    const payload = app.get(JwtService).decode<{ sub: string; sid: string }>(valid);
    const expired = app
      .get(JwtService)
      .sign({ sub: payload.sub, sid: payload.sid, exp: Math.floor(Date.now() / 1000) - 60 });
    c.cookies.set('access_token', expired);

    const response = await c.get('/api/v1/auth/session');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SESSION_EXPIRED');

    const refreshed = await c.send('post', '/api/v1/auth/refresh');
    expect(refreshed.status).toBe(204);
    expect((await c.get('/api/v1/auth/session')).status).toBe(200);
  });

  it('changes the interface language with PATCH /me', async () => {
    const c = client();
    await c.signIn(email('active'), PASSWORD);

    const response = await c.send('patch', '/api/v1/me', { preferredLanguage: 'ar' });
    expect(response.status).toBe(200);
    expect(response.body.preferredLanguage).toBe('ar');

    await c.send('patch', '/api/v1/me', { preferredLanguage: 'en' });
  });

  it('rotates the refresh token, and revokes the session when an old one is reused', async () => {
    const c = client();
    await c.signIn(email('active'), PASSWORD);
    const firstRefreshToken = c.cookies.get('refresh_token');

    expect((await c.send('post', '/api/v1/auth/refresh')).status).toBe(204);
    expect(c.cookies.get('refresh_token')).not.toBe(firstRefreshToken);

    // A stolen copy of the first token comes back.
    const thief = client();
    thief.cookies.set('refresh_token', firstRefreshToken ?? '');
    thief.cookies.set('access_token', c.cookies.get('access_token') ?? '');
    thief.cookies.set('csrf_token', c.cookies.get('csrf_token') ?? '');
    thief.csrfToken = c.csrfToken;
    const reuse = await thief.send('post', '/api/v1/auth/refresh');
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('SESSION_REVOKED');

    // The real user's session has ended too.
    const session = await c.get('/api/v1/auth/session');
    expect(session.status).toBe(401);
    expect(session.body.error.code).toBe('SESSION_REVOKED');
  });

  it('signs out: the session stops working at once and the cookies are cleared', async () => {
    const c = client();
    await c.signIn(email('active'), PASSWORD);
    const accessToken = c.cookies.get('access_token') ?? '';

    const response = await c.send('post', '/api/v1/auth/sign-out');
    expect(response.status).toBe(204);
    expect(c.cookies.has('access_token')).toBe(false);
    expect(c.cookies.has('refresh_token')).toBe(false);

    // The old access token, still within its 10 minutes, no longer works.
    const replay = client();
    replay.cookies.set('access_token', accessToken);
    const session = await replay.get('/api/v1/auth/session');
    expect(session.status).toBe(401);
    expect(session.body.error.code).toBe('SESSION_REVOKED');
  });
});
