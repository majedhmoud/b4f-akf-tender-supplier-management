import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useEmployeeTendersFindOne,
  useEmployeeTendersDownload,
} from '@/lib/api/generated/employee-tenders/employee-tenders';
import { ApiError } from '@/lib/api/mutator';
import messages from '@/messages/en.json';
import { EmployeeTenderDetail } from './EmployeeTenderDetail';

// Protects invisible-record handling, read-only accepted tenders and private downloads.
vi.mock('next/navigation', () => ({ useParams: () => ({ tenderId: 't-1' }) }));
vi.mock('@/lib/useSession', () => ({ useSession: () => ({ session: { user: { id: 'u-1' } } }) }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/lib/api/generated/employee-tenders/employee-tenders', () => ({
  useEmployeeTendersFindOne: vi.fn(),
  useEmployeeTendersDownload: vi.fn(),
}));
const tender = {
  id: 't-1',
  status: 'draft',
  revision: 1,
  categoryCode: 'construction',
  estimatedBalance: { amount: '250.00', currency: 'USD' },
  allowedActions: ['edit'],
  translations: [{ language: 'en', title: 'School repairs', description: 'Repair the roof.' }],
  documents: [],
  deadlines: null,
  cancellationReason: null,
};
function mount(edit = false) {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <EmployeeTenderDetail tenderId="t-1" edit={edit} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return client;
}
describe('EmployeeTenderDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useEmployeeTendersFindOne).mockReturnValue({
      data: tender,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useEmployeeTendersFindOne>);
  });
  it('offers editing for a draft only when the server permits it', () => {
    mount();
    expect(screen.getByRole('link', { name: 'Edit draft' })).toHaveAttribute(
      'href',
      '/employee/tenders/t-1/edit',
    );
    expect(screen.getByText('250.00')).toBeInTheDocument();
  });
  it('switches the displayed section and exposes its selected state', () => {
    mount();
    expect(screen.getByRole('tab', { name: 'Basic information' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByText('Repair the roof.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Title and description' }));
    expect(screen.getByRole('tabpanel', { name: 'Title and description' })).toHaveTextContent(
      'Repair the roof.',
    );
    expect(screen.queryByText('250.00')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Terms of Reference' }));
    expect(screen.getByRole('tabpanel', { name: 'Terms of Reference' })).toHaveTextContent(
      messages.Tender.noDocuments,
    );
    expect(screen.queryByText('Repair the roof.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Basic information' }));
    expect(screen.getByRole('tabpanel', { name: 'Basic information' })).toHaveTextContent('250.00');
  });
  it('renders an accepted tender as read-only even at the edit URL', () => {
    vi.mocked(useEmployeeTendersFindOne).mockReturnValue({
      data: { ...tender, status: 'accepted', allowedActions: [] },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useEmployeeTendersFindOne>);
    mount(true);
    expect(screen.queryByRole('link', { name: 'Edit draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('no longer editable');
  });
  it('shows no tender contents on 404', () => {
    vi.mocked(useEmployeeTendersFindOne).mockReturnValue({
      isPending: false,
      isError: true,
      error: new ApiError(404, { error: { code: 'NOT_FOUND' } }),
    } as unknown as ReturnType<typeof useEmployeeTendersFindOne>);
    mount();
    expect(screen.getByText('This tender is not available to your account.')).toBeInTheDocument();
    expect(screen.queryByText('School repairs')).not.toBeInTheDocument();
  });
  it('uses the private employee download and displays a failed download', async () => {
    const refetch = vi.fn().mockResolvedValue({ error: new Error('network') });
    vi.mocked(useEmployeeTendersDownload).mockReturnValue({
      refetch,
      isFetching: false,
    } as unknown as ReturnType<typeof useEmployeeTendersDownload>);
    vi.mocked(useEmployeeTendersFindOne).mockReturnValue({
      data: {
        ...tender,
        documents: [{ id: 'doc-1', name: 'Terms.pdf', language: 'en', translations: [] }],
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useEmployeeTendersFindOne>);
    const client = mount();
    const key = ['me', 'u-1', 'employee-tenders', 'en', 'download', 't-1', 'doc-1'];
    client.setQueryData(key, { url: '/temporary-signed-url' });
    fireEvent.click(screen.getByRole('tab', { name: 'Terms of Reference' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be downloaded');
    expect(client.getQueryData(key)).toBeUndefined();
    expect(useEmployeeTendersDownload).toHaveBeenCalledWith('t-1', 'doc-1', {
      query: {
        queryKey: ['me', 'u-1', 'employee-tenders', 'en', 'download', 't-1', 'doc-1'],
        enabled: false,
        retry: false,
        gcTime: 0,
      },
    });
  });
});
