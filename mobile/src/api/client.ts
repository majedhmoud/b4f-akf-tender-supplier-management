import { apiOrigin } from '@/config/env';
import type { Locale } from '@/locale/messages';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`API responded with status ${status}`);
  }
}

export async function getJson<T>(
  path: string,
  locale: Locale,
  signal?: AbortSignal,
): Promise<T> {
  return request<T>(path, { locale, signal });
}

export function getPrivateJson<T>(
  path: string,
  token: string,
  locale: Locale,
  signal: AbortSignal,
) {
  return request<T>(path, { locale, signal, token });
}

export async function postSession<T>(path: string, body: object): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    return await request<T>(`/mobile/auth/${path}`, {
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function request<T>(
  path: string,
  {
    locale,
    signal,
    token,
    body,
  }: { locale?: Locale; signal?: AbortSignal; token?: string; body?: object },
): Promise<T> {
  const origin = apiOrigin();
  if ((token || body) && !__DEV__ && !origin.startsWith('https://')) {
    throw new Error('Mobile sessions require an HTTPS API origin.');
  }
  const response = await fetch(`${origin}/api/v1${path}`, {
    credentials: 'omit',
    method: body ? 'POST' : 'GET',
    headers: {
      Accept: 'application/json',
      ...(locale && { 'Accept-Language': locale }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string };
    } | null;
    throw new ApiError(response.status, payload?.error?.code);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
