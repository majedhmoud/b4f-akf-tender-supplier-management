import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en.json';
import { SiteHeader } from './SiteHeader';

// Header controls reflect the current session and preserve translated errors.
const mocks = vi.hoisted(() => ({
  session: null as { user: { email: string; displayName: string; roles: string[] } } | null,
  signOut: vi.fn(),
}));
vi.mock('@/lib/useSession', () => ({
  useSession: () => ({ session: mocks.session, isLoading: false, signOut: mocks.signOut }),
}));
vi.mock('./LanguageSwitch', () => ({ LanguageSwitch: () => null }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/tenders',
  Link: ({ children, href, ...props }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
describe('SiteHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = null;
    mocks.signOut.mockResolvedValue(undefined);
  });
  it('offers sign-in when signed out', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SiteHeader />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getByRole('link', { name: 'Supplier sign-up' })).toHaveAttribute(
      'href',
      '/supplier-application',
    );
    expect(screen.getByRole('link', { name: 'Tenders' })).toHaveAttribute('aria-current', 'page');
  });
  it('links signed-in users to their profile', () => {
    mocks.session = {
      user: { email: 'employee@akf-demo.test', displayName: 'Lina Haddad', roles: ['employee'] },
    };
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SiteHeader />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('link', { name: 'My profile: Lina Haddad' })).toHaveAttribute(
      'href',
      '/profile',
    );
  });
  it.each([
    { role: 'legal_committee', label: 'Legal review queue', href: '/signup-reviews' },
    { role: 'admin', label: 'Raised sign-up requests', href: '/signup-requests' },
  ])('shows the $role queue without other staff navigation', ({ role, label }) => {
    mocks.session = {
      user: { email: 'staff@example.test', displayName: 'Rana Saleh', roles: [role] },
    };
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SiteHeader />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My profile: Rana Saleh' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(screen.queryByRole('link', { name: 'Manage tenders' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My tenders' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Supplier sign-up' })).not.toBeInTheDocument();
  });
  it('shows the staff name and signs out', async () => {
    mocks.session = {
      user: {
        email: 'officer@akf-demo.test',
        displayName: 'Omar Khalil',
        roles: ['procurement_officer'],
      },
    };
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SiteHeader />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Omar Khalil')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Manage tenders' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My tenders' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
  });
});
