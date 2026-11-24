import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionView } from '@/lib/api/generated/model/sessionView';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';
import { UserProfile } from './UserProfile';

// Protects account-only rendering and guest redirects without another profile API.
const mocks = vi.hoisted(() => ({
  session: null as SessionView | null,
  isLoading: false,
  error: null as unknown,
  retry: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('@/lib/useSession', () => ({ useSession: () => mocks }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('tab=account') }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/profile',
  useRouter: () => ({ replace: mocks.replace }),
}));
function mount(locale = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar}>
      <UserProfile />
    </NextIntlClientProvider>,
  );
}
function signIn(roles: SessionView['user']['roles']) {
  mocks.session = {
    user: { id: 'user-1', email: 'account@example.test', roles, preferredLanguage: 'ar' },
    supplier: null,
    serverTime: '2026-11-24T00:00:00Z',
  };
}
describe('UserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = null;
    mocks.isLoading = false;
    mocks.error = null;
  });
  it.each(['supplier', 'employee', 'procurement_officer', 'admin', 'legal_committee'] as const)(
    'shows the actual account fields for %s',
    (role) => {
      signIn([role]);
      mount();
      expect(screen.getByRole('heading', { name: 'My profile' })).toBeInTheDocument();
      expect(screen.getByText('account@example.test')).toHaveAttribute('dir', 'ltr');
      expect(screen.getByText(en.Profile.role[role])).toBeInTheDocument();
      expect(screen.getByText('Arabic')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(mocks.replace).not.toHaveBeenCalled();
    },
  );
  it('redirects guests preserving the destination and locale', async () => {
    mount('ar');
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        { pathname: '/sign-in', query: { returnTo: '/profile?tab=account' } },
        { locale: 'ar' },
      ),
    );
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
  it('waits for session discovery before redirecting', () => {
    mocks.isLoading = true;
    mount();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
  it('shows retry on session failure without revealing account data', () => {
    signIn(['admin']);
    mocks.error = new Error('Connection failed');
    mount();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('account@example.test')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mocks.retry).toHaveBeenCalledOnce();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('renders translated roles and handles accounts with no global role', () => {
    signIn([]);
    const { unmount } = mount('ar');
    expect(screen.getByText(ar.Profile.noRoles)).toBeInTheDocument();
    unmount();
    signIn(['employee', 'legal_committee']);
    mount('ar');
    expect(screen.getByRole('heading', { name: ar.Profile.title })).toBeInTheDocument();
    expect(screen.getByText(ar.Profile.role.employee)).toBeInTheDocument();
    expect(screen.getByText(ar.Profile.role.legal_committee)).toBeInTheDocument();
  });
});
