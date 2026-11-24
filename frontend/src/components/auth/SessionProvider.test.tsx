import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { useSession } from '@/lib/useSession';
import messages from '@/messages/en.json';
import { SessionProvider } from './SessionProvider';

// Protects identity-scoped queries and cache clearing across account changes.
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  replace: vi.fn(),
  reset: vi.fn(),
  sync: vi.fn(),
  advance: vi.fn(),
  ended: null as (() => void) | null,
  pathname: '/employee/tenders',
}));
vi.mock('@/lib/api/mutator', async (original) => ({
  ...(await original<typeof import('@/lib/api/mutator')>()),
  apiFetch: mocks.fetch,
  resetCsrfToken: mocks.reset,
  syncServerClock: mocks.sync,
  advanceSessionGeneration: mocks.advance,
  onSessionEnded: (handler: () => void) => {
    mocks.ended = handler;
    return () => {
      mocks.ended = null;
    };
  },
}));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));
const session = {
  user: {
    id: 'u-1',
    email: 'employee@akf-demo.test',
    preferredLanguage: 'en' as const,
    roles: ['employee' as const],
  },
  supplier: null,
  serverTime: '2026-11-24T00:00:00Z',
};
function Consumer() {
  const state = useSession();
  return (
    <>
      <span>{state.session?.user.email ?? (state.isLoading ? 'Loading' : 'Signed out')}</span>
      <button onClick={() => void state.signOut()}>Logout</button>
      <button
        onClick={() => void state.establish({ ...session, user: { ...session.user, id: 'u-2' } })}
      >
        New session
      </button>
    </>
  );
}
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(['old-private'], 'secret');
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <SessionProvider>
          <Consumer />
        </SessionProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return client;
}
describe('SessionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = '/employee/tenders';
    mocks.sync.mockResolvedValue(undefined);
    mocks.fetch.mockImplementation(async (path: string) =>
      path.endsWith('/sign-out') ? undefined : session,
    );
  });
  it('bootstraps into a user-specific query key', async () => {
    const client = mount();
    await screen.findByText(session.user.email);
    expect(client.getQueryData(privateKey('u-1', ['session']))).toEqual(session);
    expect(client.getQueryData(privateKey('', ['session']))).toBeUndefined();
  });
  it('clears all old data and resets CSRF after sign-in', async () => {
    const client = mount();
    await screen.findByText(session.user.email);
    fireEvent.click(screen.getByText('New session'));
    await waitFor(() => expect(client.getQueryData(privateKey('u-2', ['session']))).toBeDefined());
    expect(client.getQueryData(['old-private'])).toBeUndefined();
    expect(client.getQueryData(privateKey('u-1', ['session']))).toBeUndefined();
    expect(mocks.reset).toHaveBeenCalled();
    expect(mocks.sync).toHaveBeenCalled();
  });
  it('redirects an ended session with returnTo and clears data', async () => {
    window.history.replaceState({}, '', '/en/employee/tenders?status=draft');
    const client = mount();
    await screen.findByText(session.user.email);
    await act(async () => mocks.ended?.());
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        {
          pathname: '/sign-in',
          query: { returnTo: '/en/employee/tenders?status=draft' },
        },
        { locale: 'en' },
      ),
    );
    expect(client.getQueryData(['old-private'])).toBeUndefined();
    expect(mocks.reset).toHaveBeenCalled();
  });
  it('signs out on the server, clears the cache and navigates to tenders', async () => {
    const client = mount();
    await screen.findByText(session.user.email);
    fireEvent.click(screen.getByText('Logout'));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/tenders', { locale: 'en' }));
    expect(mocks.fetch).toHaveBeenCalledWith(
      '/api/v1/auth/sign-out',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(client.getQueryData(['old-private'])).toBeUndefined();
    expect(mocks.reset).toHaveBeenCalled();
  });
  it.each(['/signup-reviews', '/signup-requests', '/profile'])(
    'redirects an ended session on %s before identity bootstrap',
    async (pathname) => {
      mocks.pathname = pathname;
      window.history.replaceState({}, '', '/en' + pathname);
      mocks.fetch.mockRejectedValue(new ApiError(401, { error: { code: 'UNAUTHENTICATED' } }));
      const client = mount();
      await screen.findByText('Signed out');
      await act(async () => mocks.ended?.());
      await waitFor(() =>
        expect(mocks.replace).toHaveBeenCalledWith(
          { pathname: '/sign-in', query: { returnTo: '/en' + pathname } },
          { locale: 'en' },
        ),
      );
      expect(client.getQueryData(['old-private'])).toBeUndefined();
    },
  );
  it('leaves an anonymous visitor on the public page', async () => {
    mocks.pathname = '/tenders';
    mocks.fetch.mockRejectedValue(new ApiError(401, { error: { code: 'UNAUTHENTICATED' } }));
    mount();
    await screen.findByText('Signed out');
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
