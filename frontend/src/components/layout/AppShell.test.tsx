import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/lib/api/generated/model/role';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';
import { AppShell } from './AppShell';

// Protects role navigation, Arabic labels, and rendering during session discovery.
const mocks = vi.hoisted(() => ({
  session: null as { user: { email: string; roles: Role[] } } | null,
  isLoading: false,
  pathname: '/profile',
}));
vi.mock('@/lib/useSession', () => ({ useSession: () => ({ ...mocks, signOut: vi.fn() }) }));
vi.mock('./LanguageSwitch', () => ({ LanguageSwitch: () => null }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => mocks.pathname,
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));
function mount(locale = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar}>
      <AppShell>
        <h1>Route content</h1>
      </AppShell>
    </NextIntlClientProvider>,
  );
}
function signIn(roles: Role[]) {
  mocks.session = { user: { email: 'user@example.test', roles } };
}
describe('AppShell', () => {
  beforeEach(() => {
    mocks.session = null;
    mocks.isLoading = false;
    mocks.pathname = '/profile';
  });
  it.each([false, true])('renders children while anonymous (loading: %s)', (loading) => {
    mocks.isLoading = loading;
    mount();
    expect(screen.getByRole('heading', { name: 'Route content' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My profile' })).not.toBeInTheDocument();
  });
  it.each([
    ['employee', 'My tenders', '/employee/tenders'],
    ['procurement_officer', 'Manage tenders', '/manage/tenders'],
    ['legal_committee', 'Legal review queue', '/signup-reviews'],
    ['admin', 'Raised sign-up requests', '/signup-requests'],
    ['supplier', 'Tenders', '/tenders'],
  ] as const)('shows only implemented links for %s', (role, label, href) => {
    signIn([role]);
    mocks.pathname = href + '/record';
    mount();
    const sidebar = within(screen.getByRole('complementary'));
    fireEvent.click(sidebar.getByRole('button', { name: 'Navigation menu' }));
    expect(sidebar.getByRole('link', { name: label })).toHaveAttribute('href', href);
    expect(sidebar.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    expect(sidebar.getByRole('link', { name: 'My profile' })).toHaveAttribute('href', '/profile');
    const queueLinks = [
      ['employee', 'My tenders'],
      ['procurement_officer', 'Manage tenders'],
      ['legal_committee', 'Legal review queue'],
      ['admin', 'Raised sign-up requests'],
    ];
    for (const [owner, name] of queueLinks) {
      if (owner !== role) expect(sidebar.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    if (role === 'legal_committee')
      expect(sidebar.queryByRole('link', { name: 'Tenders' })).not.toBeInTheDocument();
    fireEvent.click(sidebar.getByRole('link', { name: label }));
    expect(sidebar.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });
  it('shows all applicable roles and an expandable menu with Arabic labels', () => {
    signIn(['employee', 'admin']);
    mount('ar');
    const sidebar = within(screen.getByRole('complementary'));
    const button = sidebar.getByRole('button', { name: ar.Nav.toggle });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(sidebar.getByRole('navigation')).toHaveAttribute(
      'id',
      button.getAttribute('aria-controls'),
    );
    expect(sidebar.getByRole('link', { name: ar.Nav.profile })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(sidebar.getByRole('link', { name: ar.Nav.myTenders })).toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: ar.Signup.adminQueue })).toBeInTheDocument();
  });
});
