import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import type { App } from 'supertest/types.js';
import { SetupTokens } from '../src/account-setup/setup-tokens.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { EmailQueue } from '../src/notifications/email-queue.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { uniqueRunId } from './support/run-id.js';
import { TestClient } from './support/test-client.js';

process.env.COOKIE_SECURE = 'false';
process.env.SIGN_IN_RATE_LIMIT = '1000';

describe('Employee accounts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const enqueue = vi.fn();
  const runId = uniqueRunId();
  const adminEmail = 'admin-' + runId + '@test.local';
  const employeeEmail = 'employee-' + runId + '@test.local';
  const password = 'a test staff password';
  const path = '/api/v1/admin/employees';
  const input = {
    displayName: '  Example Employee  ',
    email: employeeEmail.toUpperCase(),
    preferredLanguage: 'ar',
  };

  const client = () => new TestClient(app.getHttpServer());

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailQueue)
      .useValue({ enqueue })
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.userAccount.create({
      data: {
        email: adminEmail,
        displayName: 'Test administrator',
        preferredLanguage: 'en',
        status: 'active',
        passwordHash: await bcrypt.hash(password, 4),
        roles: { create: { role: 'admin' } },
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      const accounts = await prisma.userAccount.findMany({
        where: { email: { in: [adminEmail, employeeEmail] } },
        select: { id: true },
      });
      const ids = accounts.map(({ id }) => id);
      await prisma.auditEvent.deleteMany({ where: { resourceId: { in: ids } } });
      await prisma.emailMessage.deleteMany({ where: { recipientUserId: { in: ids } } });
      await prisma.accountSetupToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.userAccount.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });

  it('enforces staff authorization and creates an account that can finish setup', async () => {
    const visitor = client();
    await visitor.fetchCsrf();
    expect((await visitor.send('post', path, input)).status).toBe(401);

    const admin = client();
    expect((await admin.signIn(adminEmail, password)).status).toBe(200);
    expect((await admin.send('post', path, input, false)).status).toBe(403);
    expect((await admin.send('post', path, { ...input, role: 'admin' })).status).toBe(400);
    expect((await admin.send('post', path, { ...input, displayName: '   ' })).status).toBe(400);

    const created = await admin.send('post', path, input);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toEqual({
      id: expect.any(String),
      email: employeeEmail,
      status: 'pending_setup',
    });
    expect(enqueue).toHaveBeenCalledOnce();
    expect((await admin.send('post', path, input)).body.error.code).toBe(
      'EMAIL_ALREADY_REGISTERED',
    );

    const account = await prisma.userAccount.findUniqueOrThrow({
      where: { email: employeeEmail },
      include: { roles: true },
    });
    expect(account.displayName).toBe('Example Employee');
    expect(account.passwordHash).toBeNull();
    expect(account.roles.map(({ role }) => role)).toEqual(['employee']);
    expect(
      await prisma.auditEvent.count({
        where: { action: 'employee_account.created', resourceId: account.id },
      }),
    ).toBe(1);

    const link = await app.get(SetupTokens).currentLink(account.id, 'ar');
    const token = new URLSearchParams(new URL(link!).hash.slice(1)).get('token');
    const verify = await visitor.send('post', '/api/v1/account-setup/verify', { token });
    expect(verify.status).toBe(200);
    expect(verify.body).toMatchObject({ preferredLanguage: 'ar', accountType: 'employee' });
    const complete = await visitor.send('post', '/api/v1/account-setup/complete', {
      token,
      password,
    });
    expect(complete.status).toBe(200);
    expect(complete.body.next).toBe('employee_tenders');
    await visitor.fetchCsrf();
    expect((await visitor.send('post', path, input)).status).toBe(404);
  });
});
