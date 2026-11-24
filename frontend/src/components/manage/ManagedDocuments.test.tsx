import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/mutator';
import { ManagedDocuments } from './ManagedDocuments';
import { ManagementTestProvider, tender } from './managementTestUtils';

// Multipart uploads retain the reviewed revision and translated-copy ownership.
const mocks = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), download: vi.fn() }));
vi.mock('@/lib/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'officer' } } }),
}));
vi.mock('@/lib/api/generated/tender-management/tender-management', () => ({
  useManageTendersUpload: () => ({ mutateAsync: mocks.upload }),
  useManageTendersRemoveDocument: () => ({ mutateAsync: mocks.remove }),
  useManageTendersDownload: () => ({ refetch: mocks.download, isFetching: false }),
}));
const documents = [
  {
    id: 'doc-1',
    name: 'Terms.pdf',
    kind: 'terms_of_reference',
    language: 'en',
    translations: [{ id: 'doc-2', name: 'Arabic.pdf', language: 'ar' }],
  },
];
function mount(status = tender.status) {
  const done = vi.fn().mockResolvedValue(undefined);
  render(
    <ManagedDocuments tender={{ ...tender, status, documents }} done={done} reload={vi.fn()} />,
    { wrapper: ManagementTestProvider },
  );
  return done;
}
describe('Managed Terms of Reference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upload.mockResolvedValue({});
    mocks.remove.mockResolvedValue({});
  });
  it('uploads a selected file as a linked Arabic translation', async () => {
    const done = mount();
    const file = new File(['pdf'], 'translated.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Terms of Reference file'), {
      target: { files: [file] },
    });
    fireEvent.change(screen.getByLabelText('Document language'), { target: { value: 'ar' } });
    fireEvent.change(screen.getByLabelText('Translated copy of'), { target: { value: 'doc-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload document' }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(mocks.upload).toHaveBeenCalledWith({
      tenderId: 't-1',
      data: {
        revision: 5,
        kind: 'terms_of_reference',
        file,
        language: 'ar',
        translationOf: 'doc-1',
      },
    });
  });
  it('requires a file', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Upload document' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a file');
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('confirms cascading removal and sends the revision', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Terms.pdf' }));
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: /Removing an original/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }));
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({
        tenderId: 't-1',
        docId: 'doc-1',
        params: { revision: 5 },
      }),
    );
  });
  it('keeps published documents downloadable without write actions', () => {
    mount('published');
    expect(screen.getAllByRole('button', { name: 'Download' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Upload document' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Terms.pdf' })).not.toBeInTheDocument();
  });
  it('shows translated download failure without server details', async () => {
    mount();
    mocks.download.mockResolvedValue({
      error: new ApiError(404, { error: { code: 'NOT_FOUND' } }),
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Download' })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be downloaded');
  });
});
