import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en.json';
import { StaffGuard } from './StaffGuard';

// A staff page must stay hidden until its role check succeeds.
const mocks = vi.hoisted(() => ({ replace: vi.fn(), roles: [] as string[] }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/manage/tenders',
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock('@/lib/useSession', () => ({
  useSession: () => ({
    session: { user: { roles: mocks.roles } },
    isLoading: false,
    error: null,
    retry: vi.fn(),
  }),
}));
describe('StaffGuard', () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.roles = [];
  });
  it('hides the page from a different staff role', async () => {
    mocks.roles = ['employee'];
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <StaffGuard>Private content</StaffGuard>
      </NextIntlClientProvider>,
    );
    expect(screen.queryByText('Private content')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        {
          pathname: '/sign-in',
          query: { returnTo: '/manage/tenders' },
        },
        { locale: 'en' },
      ),
    );
  });
  it('shows the officer page to an officer', () => {
    mocks.roles = ['procurement_officer'];
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <StaffGuard>Private content</StaffGuard>
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Private content')).toBeInTheDocument();
  });
});
