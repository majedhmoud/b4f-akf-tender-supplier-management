import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { usePublicTendersFindOne } from '@/lib/api/generated/public-tenders/public-tenders';
import { ApiError } from '@/lib/api/mutator';
import messages from '@/messages/en.json';
import { TenderDetail } from './TenderDetail';

// Pins the public tender detail: content in its own language with a fallback
// notice, deadlines by server time, and a not-found state for a tender that is
// not public (API_CONTRACT.md, Public Tenders).
vi.mock('next/navigation', () => ({ useParams: () => ({ tenderId: 't-1' }) }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/lib/useServerNow', () => ({ useServerNow: () => Date.parse('2026-12-11T09:00:00Z') }));
vi.mock('@/components/bids/TenderBidAction', () => ({ TenderBidAction: () => null }));
vi.mock('@/lib/api/generated/public-tenders/public-tenders', () => ({
  usePublicTendersFindOne: vi.fn(),
  getPublicTendersFindOneQueryKey: () => ['/api/v1/tenders/t-1'],
  publicTendersDownload: vi.fn(),
}));

function renderDetail(result: object) {
  vi.mocked(usePublicTendersFindOne).mockReturnValue(
    result as unknown as ReturnType<typeof usePublicTendersFindOne>,
  );
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TenderDetail tenderId="t-1" />
    </NextIntlClientProvider>,
  );
}

describe('TenderDetail', () => {
  it('shows Arabic-only content right to left, with a fallback notice and passed deadlines', () => {
    renderDetail({
      isPending: false,
      isError: false,
      data: {
        id: 't-1',
        status: 'published',
        categoryCode: 'goods_and_supplies',
        content: { language: 'ar', title: 'توريد لوازم مدرسية', description: 'دفاتر.' },
        requestedLanguage: 'en',
        isFallback: true,
        availableLanguages: ['ar'],
        deadlines: {
          application: '2026-12-10T12:00:00Z',
          technical: '2026-12-17T12:00:00Z',
          financial: '2026-12-24T12:00:00Z',
        },
        documents: [],
        serverTime: '2026-12-11T09:00:00Z',
      },
    });

    expect(screen.getByRole('heading', { name: 'توريد لوازم مدرسية' })).toHaveAttribute(
      'dir',
      'rtl',
    );
    expect(screen.getByText('This tender is only available in Arabic.')).toBeInTheDocument();
    expect(screen.getByText(/passed/)).toBeInTheDocument();
    expect(screen.getByText('No documents attached.')).toBeInTheDocument();
  });

  it('says the tender is not available when the API answers 404', () => {
    renderDetail({
      isPending: false,
      isError: true,
      error: new ApiError(404, { error: { code: 'NOT_FOUND' } }),
      refetch: vi.fn(),
    });

    expect(screen.getByText('This tender is not available.')).toBeInTheDocument();
  });
});
