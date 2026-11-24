import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEmployeeTendersList } from '@/lib/api/generated/employee-tenders/employee-tenders';
import messages from '@/messages/en.json';
import { EmployeeTenderList } from './EmployeeTenderList';

// Protects user/locale cache scope, saved-data rows, and URL pagination.
const mocks = vi.hoisted(() => ({ replace: vi.fn(), search: new URLSearchParams('page=2') }));
vi.mock('next/navigation', () => ({ useSearchParams: () => mocks.search }));
vi.mock('@/lib/useSession', () => ({ useSession: () => ({ session: { user: { id: 'u-1' } } }) }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  Link: ({ children, href, ...props }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/api/generated/employee-tenders/employee-tenders', () => ({
  useEmployeeTendersList: vi.fn(),
}));
function mount() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <EmployeeTenderList />
    </NextIntlClientProvider>,
  );
}
describe('EmployeeTenderList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = new URLSearchParams('page=2');
  });
  it('shows only the returned rows with creation dates and status', () => {
    vi.mocked(useEmployeeTendersList).mockReturnValue({
      data: {
        data: [
          {
            id: 't-1',
            status: 'draft',
            categoryCode: 'construction',
            content: { title: 'ترميم مدرسة', language: 'ar' },
            isFallback: true,
            createdAt: '2026-11-23T08:30:00Z',
          },
        ],
        meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useEmployeeTendersList>);
    mount();
    expect(screen.getByRole('link', { name: 'ترميم مدرسة' })).toHaveAttribute(
      'href',
      '/employee/tenders/t-1',
    );
    expect(screen.getByRole('link', { name: 'ترميم مدرسة' })).toHaveAttribute('dir', 'rtl');
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(useEmployeeTendersList).toHaveBeenCalledWith(
      { page: 2, limit: 20 },
      {
        query: {
          queryKey: ['me', 'u-1', 'employee-tenders', 'en', 'list', 2],
          enabled: true,
          retry: false,
        },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(mocks.replace).toHaveBeenCalledWith({
      pathname: '/employee/tenders',
      query: { page: 1 },
    });
  });
  it('shows an empty state and a working create link', () => {
    vi.mocked(useEmployeeTendersList).mockReturnValue({
      data: { data: [], meta: { totalPages: 0 } },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useEmployeeTendersList>);
    mount();
    expect(screen.getByText('You have no tenders yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create tender draft' })).toHaveAttribute(
      'href',
      '/employee/tenders/new',
    );
  });
});
