import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useManageTendersFindOne } from '@/lib/api/generated/tender-management/tender-management';
import { ApiError } from '@/lib/api/mutator';
import { ManagedTenderDetail } from './ManagedTenderDetail';
import { ManagementTestProvider, tender } from './managementTestUtils';

// Actions follow both lifecycle and allowedActions; no bid content is fetched.
const mocks = vi.hoisted(() => ({ copy: vi.fn(), push: vi.fn(), refetch: vi.fn() }));
vi.mock('next/navigation', () => ({ useParams: () => ({ tenderId: 't-1' }) }));
vi.mock('@/lib/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'officer' } } }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/lib/api/generated/tender-management/tender-management', () => ({
  useManageTendersFindOne: vi.fn(),
  useManageTendersCopy: () => ({ mutateAsync: mocks.copy }),
}));
vi.mock('./ManagedTenderForm', () => ({
  ManagedTenderForm: () => <p>Editing panel</p>,
  PublishTenderForm: () => <p>Publication panel</p>,
}));
vi.mock('./ManagedDocuments', () => ({ ManagedDocuments: () => <p>Documents panel</p> }));
function response(data = tender) {
  vi.mocked(useManageTendersFindOne).mockReturnValue({
    data,
    isPending: false,
    isError: false,
    refetch: mocks.refetch,
  } as unknown as ReturnType<typeof useManageTendersFindOne>);
}
function mount() {
  render(<ManagedTenderDetail tenderId="t-1" />, { wrapper: ManagementTestProvider });
}
describe('Officer tender details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refetch.mockResolvedValue({ data: tender });
    mocks.copy.mockResolvedValue({ id: 'copy-1' });
    response();
  });
  it('shows permitted preparation panels without rendering a committee action before data loads', () => {
    mount();
    expect(screen.getByRole('link', { name: 'Supplier bid form' })).toHaveAttribute(
      'href',
      '/manage/tenders/t-1/bid-form',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Accept / edit' }));
    expect(screen.getByText('Editing panel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /raise.*committee/i })).not.toBeInTheDocument();
    expect(useManageTendersFindOne).toHaveBeenCalledWith('t-1', {
      query: {
        queryKey: ['me', 'officer', 'manage-tenders', 'en', 'detail', 't-1'],
        enabled: true,
        retry: false,
      },
    });
  });
  it('hides preparation writes after publication', () => {
    response({ ...tender, status: 'published', allowedActions: ['raise_committee'] });
    mount();
    expect(screen.queryByRole('button', { name: 'Accept / edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.getByText('This tender is read-only.')).toBeInTheDocument();
  });
  it('does not expose the bid form before acceptance', () => {
    response({ ...tender, status: 'draft', allowedActions: ['accept'] });
    mount();
    expect(screen.queryByRole('link', { name: 'Supplier bid form' })).not.toBeInTheDocument();
  });
  it('hides invisible tender data on 404', () => {
    vi.mocked(useManageTendersFindOne).mockReturnValue({
      isPending: false,
      isError: true,
      error: new ApiError(404, { error: { code: 'NOT_FOUND' } }),
    } as unknown as ReturnType<typeof useManageTendersFindOne>);
    mount();
    expect(screen.getByText('This tender is not available to your account.')).toBeInTheDocument();
    expect(screen.queryByText('School repairs')).not.toBeInTheDocument();
  });
  it('requires confirmation before copying and opens the accepted copy', async () => {
    response({
      ...tender,
      status: 'cancelled',
      allowedActions: ['copy'],
      cancellationReason: 'no_bids',
    });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Copy cancelled tender' }));
    expect(mocks.copy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm copy' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/manage/tenders/copy-1'));
    expect(mocks.copy).toHaveBeenCalledWith({ tenderId: 't-1' });
  });
  it('links an already copied tender without allowing another copy', () => {
    response({ ...tender, status: 'cancelled', allowedActions: [], copiedIntoTenderId: 'copy-1' });
    mount();
    expect(screen.queryByRole('button', { name: 'Copy cancelled tender' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View existing copy' })).toHaveAttribute(
      'href',
      '/manage/tenders/copy-1',
    );
  });
});
