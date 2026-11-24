import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, resetCsrfToken } from './mutator';

// Pins the API layer's contract behaviour (API_CONTRACT.md §1.1, §1.5): cookies
// on every request, CSRF on unsafe methods with one retry, one shared refresh
// for an expired session, and typed errors.
function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const csrf = () => json(200, { csrfToken: 'token-1', serverTime: new Date().toISOString() });

describe('apiFetch', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    resetCsrfToken();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    document.documentElement.lang = 'ar';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends cookies and the page language, without a CSRF token on GET', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await apiFetch('/api/v1/tenders', { method: 'GET' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/tenders$/);
    expect(init?.credentials).toBe('include');
    const headers = new Headers(init?.headers);
    expect(headers.get('Accept-Language')).toBe('ar');
    expect(headers.has('X-CSRF-Token')).toBe(false);
  });

  it('adds the CSRF token to a POST, and retries once with a new token if it was invalid', async () => {
    fetchMock
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json(403, { error: { code: 'CSRF_TOKEN_INVALID' } }))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json(200, { saved: true }));

    await expect(apiFetch('/api/v1/employee/tenders', { method: 'POST' })).resolves.toEqual({
      saved: true,
    });
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('X-CSRF-Token')).toBe('token-1');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('preserves the idempotency key and multipart body across a CSRF retry', async () => {
    fetchMock
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json(403, { error: { code: 'CSRF_TOKEN_INVALID' } }))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json(201, { applicationId: 'a-1' }));
    const body = new FormData();
    body.append('application', JSON.stringify({ legalName: 'Al-Noor' }));
    body.append('files[registration_certificate]', new File(['%PDF'], 'registration.pdf'));
    await apiFetch('/api/v1/supplier-applications', {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': 'same-action-key' },
    });
    const writes = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/supplier-applications'),
    );
    expect(writes).toHaveLength(2);
    for (const [, options] of writes) {
      expect(new Headers(options?.headers).get('Idempotency-Key')).toBe('same-action-key');
      expect(new Headers(options?.headers).has('Content-Type')).toBe(false);
      expect(options?.body).toBe(body);
      expect(options?.credentials).toBe('include');
    }
  });

  it('refreshes an expired session once, even for requests running at the same time', async () => {
    let expired = true;
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/csrf')) return csrf();
      if (url.endsWith('/auth/refresh')) {
        expired = false;
        return new Response(null, { status: 204 });
      }
      return expired ? json(401, { error: { code: 'SESSION_EXPIRED' } }) : json(200, { ok: true });
    });

    await Promise.all([apiFetch('/api/v1/auth/session'), apiFetch('/api/v1/employee/tenders')]);

    const refreshes = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/auth/refresh'));
    expect(refreshes).toHaveLength(1);
  });

  it('raises ApiError with the code, fields, and details from the envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      json(409, { error: { code: 'VERSION_CONFLICT', details: { currentRevision: 3 } } }),
    );

    const error = await apiFetch('/api/v1/manage/tenders/x').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'VERSION_CONFLICT',
      details: { currentRevision: 3 },
    });
  });
});

// Terminal refresh errors use the same handler as a direct session rejection.
describe('session errors and rate limit headers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetCsrfToken();
  });
  it.each(['UNAUTHENTICATED', 'SESSION_REVOKED'])('reports %s', async (code) => {
    const { onSessionEnded } = await import('./mutator');
    const handler = vi.fn();
    const unsubscribe = onSessionEnded(handler);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { error: { code } })));
    await expect(apiFetch('/api/v1/employee/tenders')).rejects.toMatchObject({ code });
    expect(handler).toHaveBeenCalledOnce();
    unsubscribe();
  });
  it('reports a revoked refresh', async () => {
    const { onSessionEnded } = await import('./mutator');
    const handler = vi.fn();
    const unsubscribe = onSessionEnded(handler);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(401, { error: { code: 'SESSION_EXPIRED' } }))
        .mockResolvedValueOnce(csrf())
        .mockResolvedValueOnce(json(401, { error: { code: 'SESSION_REVOKED' } })),
    );
    await expect(apiFetch('/api/v1/auth/session')).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
    });
    expect(handler).toHaveBeenCalledOnce();
    unsubscribe();
  });
  it('retains Retry-After for the form countdown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'RATE_LIMITED' } }), {
          status: 429,
          headers: { 'content-type': 'application/json', 'Retry-After': '7' },
        }),
      ),
    );
    await expect(apiFetch('/api/v1/tenders')).rejects.toMatchObject({ retryAfterMs: 7000 });
  });
});
