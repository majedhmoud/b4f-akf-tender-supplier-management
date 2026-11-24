import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { TestClient } from './support/test-client.js';

// Pins the sign-in rate limit: 5 attempts per minute per IP, then 429
// RATE_LIMITED with Retry-After (ENGINEERING_STANDARDS.md §2.4). A separate
// file, so this app instance has its own counter and the real limit.
process.env.COOKIE_SECURE = 'false';
process.env.SIGN_IN_RATE_LIMIT = '5';
process.env.APPLICATION_RATE_LIMIT = '3';

describe('Sign-in rate limit (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows 5 attempts a minute, then answers 429 RATE_LIMITED with Retry-After', async () => {
    const client = new TestClient(app.getHttpServer());
    await client.fetchCsrf();
    const attempt = () =>
      client.send('post', '/api/v1/auth/sign-in', {
        email: `nobody-${Date.now()}@test.local`,
        password: 'wrong password',
      });

    for (let i = 0; i < 5; i += 1) {
      expect((await attempt()).status).toBe(401);
    }

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('limits public sign-up applications per IP, then answers 429 RATE_LIMITED', async () => {
    const client = new TestClient(app.getHttpServer());
    await client.fetchCsrf();
    const attempt = () => client.upload('/api/v1/supplier-applications', {});

    // Incomplete requests still count, so the upload endpoint cannot be flooded.
    for (let i = 0; i < 3; i += 1) {
      expect((await attempt()).status).toBe(400);
    }

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
});
