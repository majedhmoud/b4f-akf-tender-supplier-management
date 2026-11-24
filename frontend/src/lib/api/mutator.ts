// The one place the web app sends HTTP requests to the API. The generated
// client calls `apiFetch` for every endpoint. Rules from API_CONTRACT.md:
// - §1.1: every request sends cookies; every POST, PUT, PATCH, and DELETE
//   sends X-CSRF-Token; an expired session is refreshed once, shared by all
//   requests that hit it at the same time.
// - §1.5: errors arrive as { error: { code, … } }, raised here as ApiError.
// - §1.7: Accept-Language follows the page's locale.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface ApiFieldError {
  field: string;
  code: string;
}

interface ErrorBody {
  error?: {
    code?: string;
    fields?: ApiFieldError[];
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

// The UI reacts to `code` and never shows the server's message (§1.5).
export class ApiError extends Error {
  readonly code: string;
  readonly fields: ApiFieldError[];
  readonly details: Record<string, unknown>;
  readonly retryAfterMs: number;

  constructor(
    readonly status: number,
    body: unknown,
    retryAfter: string | null = null,
  ) {
    const error = (body as ErrorBody | undefined)?.error;
    super(`API request failed: ${status} ${error?.code ?? ''}`.trim());
    this.name = 'ApiError';
    this.code = error?.code ?? 'UNKNOWN_ERROR';
    this.fields = error?.fields ?? [];
    this.details = error?.details ?? {};
    const seconds = retryAfter === null ? NaN : Number(retryAfter);
    const delay = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(retryAfter ?? '') - Date.now();
    this.retryAfterMs = Number.isFinite(delay) ? Math.max(0, delay) : 60_000;
  }
}

type SessionEndedHandler = () => void;
const sessionEndedHandlers = new Set<SessionEndedHandler>();
let sessionGeneration = 0;

// Ignore terminal errors from requests belonging to an earlier sign-in.
export function advanceSessionGeneration(): void {
  sessionGeneration += 1;
}

export function onSessionEnded(handler: SessionEndedHandler): () => void {
  sessionEndedHandlers.add(handler);
  return () => {
    sessionEndedHandlers.delete(handler);
  };
}

function reportSessionEnded(error: ApiError, generation: number): void {
  if (
    generation === sessionGeneration &&
    (error.code === 'UNAUTHENTICATED' || error.code === 'SESSION_REVOKED')
  ) {
    sessionEndedHandlers.forEach((handler) => handler());
  }
}

// --- CSRF token (§1.1) ------------------------------------------------------

let csrfToken: Promise<string> | null = null;
let serverOffsetMs = 0;

async function fetchCsrfToken(): Promise<string> {
  const response = await fetch(new URL('/api/v1/auth/csrf', API_URL), { credentials: 'include' });
  if (!response.ok) throw new ApiError(response.status, await safeJson(response));
  const body = (await response.json()) as { csrfToken: string; serverTime: string };
  // Countdowns anchor to this never-cached server time (§1.1).
  serverOffsetMs = Date.parse(body.serverTime) - Date.now();
  return body.csrfToken;
}

function getCsrfToken(): Promise<string> {
  csrfToken ??= fetchCsrfToken().catch((error: unknown) => {
    csrfToken = null;
    throw error;
  });
  return csrfToken;
}

// Called after sign-in, sign-out, refresh, account setup, and a revoked
// session, so the next unsafe request fetches a token for the new session.
export function resetCsrfToken(): void {
  csrfToken = null;
}

// Loads the server clock once; countdowns then read `serverNow()`.
export async function syncServerClock(): Promise<void> {
  await getCsrfToken();
}

export function serverNow(): number {
  return Date.now() + serverOffsetMs;
}

// --- Shared refresh (§1.1) --------------------------------------------------

let refreshing: Promise<void> | null = null;

function refreshSession(): Promise<void> {
  refreshing ??= (async () => {
    try {
      const response = await send('/api/v1/auth/refresh', { method: 'POST' });
      resetCsrfToken();
      if (!response.ok)
        throw new ApiError(
          response.status,
          await safeJson(response),
          response.headers.get('Retry-After'),
        );
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

// --- Requests ---------------------------------------------------------------

function currentLanguage(): string | undefined {
  return typeof document === 'undefined' ? undefined : document.documentElement.lang || undefined;
}

async function safeJson(response: Response): Promise<unknown> {
  const isJson = response.headers.get('content-type')?.includes('application/json');
  return isJson ? response.json() : undefined;
}

async function send(path: string, options: RequestInit): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  const language = currentLanguage();
  if (language && !headers.has('Accept-Language')) headers.set('Accept-Language', language);
  if (UNSAFE_METHODS.has(method)) headers.set('X-CSRF-Token', await getCsrfToken());
  return fetch(new URL(path, API_URL), { ...options, method, headers, credentials: 'include' });
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const generation = sessionGeneration;
  let response = await send(path, options);
  let body = await safeJson(response);

  // An invalid CSRF token: fetch a new one and retry once (§1.1).
  if (response.status === 403 && new ApiError(403, body).code === 'CSRF_TOKEN_INVALID') {
    resetCsrfToken();
    response = await send(path, options);
    body = await safeJson(response);
  }

  // An expired access token: refresh once, then retry (§1.1).
  if (response.status === 401 && new ApiError(401, body).code === 'SESSION_EXPIRED') {
    try {
      await refreshSession();
      response = await send(path, options);
      body = await safeJson(response);
    } catch (error) {
      if (error instanceof ApiError) reportSessionEnded(error, generation);
      throw error;
    }
  }

  if (!response.ok) {
    const error = new ApiError(response.status, body, response.headers.get('Retry-After'));
    reportSessionEnded(error, generation);
    throw error;
  }
  return body as T;
}

// Signed download URLs come back relative to the API (ADR 0006).
export function apiUrl(path: string): string {
  return new URL(path, API_URL).toString();
}
