import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { privateKey } from '@/lib/api/query-keys';
import messages from '@/messages/en.json';
import { LanguageSwitch } from './LanguageSwitch';

// Saves a signed-in user's language before navigation and updates their session.
const mocks = vi.hoisted(() => ({ replace: vi.fn(), update: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('page=2') }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/employee/tenders',
  useRouter: () => ({ replace: mocks.replace }),
  Link: ({
    children,
    href,
    locale,
    ...props
  }: {
    children: React.ReactNode;
    href: { pathname: string };
    locale: string;
  }) => (
    <a href={'/' + locale + href.pathname} {...props}>
      {children}
    </a>
  ),
}));
const session = { user: { id: 'u-1', preferredLanguage: 'en', email: 'employee@akf-demo.test' } };
vi.mock('@/lib/useSession', () => ({ useSession: () => ({ session }) }));
vi.mock('@/lib/api/generated/auth/auth', () => ({
  useMeUpdate: () => ({ mutateAsync: mocks.update, isPending: false }),
}));
describe('LanguageSwitch', () => {
  beforeEach(() => vi.clearAllMocks());
  it('saves Arabic and retains the current page query', async () => {
    mocks.update.mockResolvedValue({ ...session.user, preferredLanguage: 'ar' });
    const client = new QueryClient();
    client.setQueryData(privateKey('u-1', ['session']), session);
    render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={messages}>
          <LanguageSwitch />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Switch to Arabic' }));
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        {
          pathname: '/employee/tenders',
          query: { page: '2' },
        },
        { locale: 'ar' },
      ),
    );
    expect(mocks.update).toHaveBeenCalledWith({ data: { preferredLanguage: 'ar' } });
    expect(client.getQueryData(privateKey('u-1', ['session']))).toMatchObject({
      user: { preferredLanguage: 'ar' },
    });
  });
  it('keeps the current language and shows an error if saving fails', async () => {
    mocks.update.mockRejectedValue(new Error('network'));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="en" messages={messages}>
          <LanguageSwitch />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Switch to Arabic' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your language could not be saved.');
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
