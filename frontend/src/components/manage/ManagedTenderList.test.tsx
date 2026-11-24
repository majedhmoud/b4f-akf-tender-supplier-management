import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useManageTendersList } from '@/lib/api/generated/tender-management/tender-management';
import { ManagedTenderList } from './ManagedTenderList';
import { ManagementTestProvider } from './managementTestUtils';

const mocks = vi.hoisted(() => ({ search: 'status=accepted&page=2', replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mocks.search) }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/lib/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'officer' } } }),
}));
vi.mock('@/lib/api/generated/tender-management/tender-management', () => ({
  useManageTendersList: vi.fn(),
}));
describe('Managed tender list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = 'status=accepted&page=2';
    vi.mocked(useManageTendersList).mockReturnValue({
      data: {
        data: [
          {
            id: 't-1',
            content: { language: 'en', title: 'School repairs' },
            requestedBy: { name: 'Lina' },
            categoryCode: 'construction',
            status: 'accepted',
            createdAt: '2026-11-20T10:00:00Z',
          },
        ],
        meta: { totalPages: 3 },
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useManageTendersList>);
  });
  it('uses the locale/user private key and status filter', () => {
    render(<ManagedTenderList />, { wrapper: ManagementTestProvider });
    expect(screen.getByRole('link', { name: 'School repairs' })).toHaveAttribute(
      'href',
      '/manage/tenders/t-1',
    );
    expect(useManageTendersList).toHaveBeenCalledWith(
      { page: 2, limit: 20, status: 'accepted' },
      {
        query: {
          queryKey: ['me', 'officer', 'manage-tenders', 'en', 'list', 'accepted', 2],
          enabled: true,
          retry: false,
        },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(mocks.replace).toHaveBeenCalledWith({
      pathname: '/manage/tenders',
      query: { page: 3, status: 'accepted' },
    });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'draft' } });
    expect(mocks.replace).toHaveBeenCalledWith({
      pathname: '/manage/tenders',
      query: { page: 1, status: 'draft' },
    });
  });
  it('ignores invalid URL filters and shows an empty state', () => {
    mocks.search = 'status=unknown&page=-1';
    vi.mocked(useManageTendersList).mockReturnValue({
      data: { data: [], meta: { totalPages: 0 } },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useManageTendersList>);
    render(<ManagedTenderList />, { wrapper: ManagementTestProvider });
    expect(screen.getByText('No tenders match this status.')).toBeInTheDocument();
    expect(vi.mocked(useManageTendersList).mock.calls[0][0]).toEqual({ page: 1, limit: 20 });
  });
});
