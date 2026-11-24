import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePublicTendersList } from '@/lib/api/generated/public-tenders/public-tenders';
import { useReferenceCategories } from '@/lib/api/generated/reference/reference';
import messages from '@/messages/en.json';
import { TenderList } from './TenderList';

// Pins the public tender list: translated categories, the fallback badge, the
// empty state, and a category filter kept in the URL (CODING_STANDARDS.md §3.3).
const replace = vi.fn();
let search = new URLSearchParams();

vi.mock('next/navigation', () => ({ useSearchParams: () => search }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/tenders',
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/useServerNow', () => ({ useServerNow: () => Date.parse('2026-11-24T09:00:00Z') }));
vi.mock('@/lib/api/generated/public-tenders/public-tenders', () => ({
  usePublicTendersList: vi.fn(),
  getPublicTendersListQueryKey: () => ['/api/v1/tenders'],
}));
vi.mock('@/lib/api/generated/reference/reference', () => ({
  useReferenceCategories: vi.fn(),
  getReferenceCategoriesQueryKey: () => ['/api/v1/reference/tender-categories'],
}));

const page = (data: object[]) => ({
  data: { data, meta: { page: 1, limit: 12, total: data.length, totalPages: 1 } },
  isPending: false,
  isError: false,
});

function renderList() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TenderList />
    </NextIntlClientProvider>,
  );
}

describe('TenderList', () => {
  beforeEach(() => {
    search = new URLSearchParams();
    replace.mockReset();
    vi.mocked(useReferenceCategories).mockReturnValue({
      data: { data: [{ code: 'information_technology' }], meta: {} },
    } as unknown as ReturnType<typeof useReferenceCategories>);
  });

  it('shows each tender with its category and a fallback badge when needed', () => {
    vi.mocked(usePublicTendersList).mockReturnValue(
      page([
        {
          id: 't-1',
          status: 'published',
          categoryCode: 'information_technology',
          content: { language: 'ar', title: 'حواسيب محمولة' },
          requestedLanguage: 'en',
          isFallback: true,
          applicationDeadline: '2026-12-03T09:00:00Z',
        },
      ]) as unknown as ReturnType<typeof usePublicTendersList>,
    );

    renderList();

    const title = screen.getByRole('link', { name: 'حواسيب محمولة' });
    expect(title).toHaveAttribute('dir', 'rtl');
    expect(title).toHaveAttribute('href', '/tenders/t-1');
    expect(screen.getByText('In Arabic')).toBeInTheDocument();
    expect(screen.getByText('Applications close in 9 days')).toBeInTheDocument();
  });

  it('shows the empty state when no tender is open', () => {
    vi.mocked(usePublicTendersList).mockReturnValue(
      page([]) as unknown as ReturnType<typeof usePublicTendersList>,
    );

    renderList();

    expect(screen.getByText('No open tenders right now.')).toBeInTheDocument();
  });

  it('puts the chosen category in the URL', () => {
    vi.mocked(usePublicTendersList).mockReturnValue(
      page([]) as unknown as ReturnType<typeof usePublicTendersList>,
    );

    renderList();
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), {
      target: { value: 'information_technology' },
    });

    expect(replace).toHaveBeenCalledWith({
      pathname: '/tenders',
      query: { category: 'information_technology' },
    });
  });
});
