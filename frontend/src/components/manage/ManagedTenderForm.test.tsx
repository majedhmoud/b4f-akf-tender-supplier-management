import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/mutator';
import { ManagedTenderForm, PublishTenderForm } from './ManagedTenderForm';
import { ManagementTestProvider, tender } from './managementTestUtils';

// Revision and status failures must never silently replace reviewed input.
const mocks = vi.hoisted(() => ({ accept: vi.fn(), update: vi.fn(), publish: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/lib/api/generated/tender-management/tender-management', () => ({
  useManageTendersAccept: () => ({ mutateAsync: mocks.accept }),
  useManageTendersUpdate: () => ({ mutateAsync: mocks.update }),
  useManageTendersPublish: () => ({ mutateAsync: mocks.publish }),
}));
vi.mock('@/lib/api/generated/reference/reference', () => ({
  useReferenceCategories: () => ({ data: { data: [{ code: 'construction' }] } }),
}));
function mount(accepting = false) {
  const done = vi.fn().mockResolvedValue(undefined);
  const reload = vi.fn().mockResolvedValue(undefined);
  render(
    <ManagedTenderForm
      tender={accepting ? { ...tender, status: 'draft', scoring: null } : tender}
      done={done}
      reload={reload}
    />,
    { wrapper: ManagementTestProvider },
  );
  return { done, reload };
}
function fillScoring() {
  for (const [name, value] of [
    ['Technical weight (%)', '70'],
    ['Financial weight (%)', '30'],
    ['Minimum technical score', '60'],
  ])
    fireEvent.change(screen.getByLabelText(name), { target: { value } });
}
function fillDeadlines(
  application = '2099-01-01T12:00',
  technical = '2099-01-02T12:00',
  financial = '2099-01-03T12:00',
) {
  for (const [name, value] of [
    ['Application deadline', application],
    ['Technical deadline', technical],
    ['Financial deadline', financial],
  ])
    fireEvent.change(screen.getByLabelText(name), { target: { value } });
  fireEvent.click(screen.getByRole('checkbox'));
}
describe('Managed tender actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accept.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
    mocks.publish.mockResolvedValue({});
  });
  it('accepts a draft using its reviewed revision and scoring only', async () => {
    const { done } = mount(true);
    fillScoring();
    fireEvent.click(screen.getByRole('button', { name: 'Accept draft and set scoring' }));
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(mocks.accept).toHaveBeenCalledWith({
      tenderId: 't-1',
      data: { revision: 5, technicalWeight: 70, financialWeight: 30, minimumTechnicalScore: 60 },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(['20', '30.5'])('rejects invalid weights (%s)', async (value) => {
    mount(true);
    fillScoring();
    fireEvent.change(screen.getByLabelText('Financial weight (%)'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept draft and set scoring' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mocks.accept).not.toHaveBeenCalled();
  });
  it('updates content and scoring without losing decimal precision', async () => {
    mount();
    fireEvent.change(screen.getByLabelText('English title (Optional)'), {
      target: { value: 'Updated school' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][0]).toEqual({
      tenderId: 't-1',
      data: {
        revision: 5,
        categoryCode: 'construction',
        estimatedBalance: { amount: '1000.00', currency: 'USD' },
        translations: [
          { language: 'en', title: 'Updated school', description: 'Repair the roof.' },
        ],
        scoring: tender.scoring,
      },
    });
  });
  it('keeps dirty input on a revision conflict and reloads only explicitly', async () => {
    mocks.update.mockRejectedValue(
      new ApiError(409, { error: { code: 'VERSION_CONFLICT', message: 'private server text' } }),
    );
    const { reload } = mount();
    fireEvent.change(screen.getByLabelText('English title (Optional)'), {
      target: { value: 'Unsaved title' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('newer revision');
    expect(screen.getByLabelText('English title (Optional)')).toHaveValue('Unsaved title');
    expect(reload).not.toHaveBeenCalled();
    expect(screen.queryByText('private server text')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload and discard my changes' }));
    expect(reload).toHaveBeenCalledOnce();
  });
  it('locks further writes after the status changes', async () => {
    mocks.update.mockRejectedValue(new ApiError(409, { error: { code: 'TENDER_STATUS_CHANGED' } }));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });
  it('publishes confirmed ordered local dates as UTC with the revision and category', async () => {
    const done = vi.fn().mockResolvedValue(undefined);
    render(<PublishTenderForm tender={tender} done={done} reload={vi.fn()} />, {
      wrapper: ManagementTestProvider,
    });
    fillDeadlines();
    fireEvent.click(screen.getByRole('button', { name: 'Publish tender' }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(mocks.publish).toHaveBeenCalledWith({
      tenderId: 't-1',
      data: {
        revision: 5,
        categoryCode: 'construction',
        deadlines: {
          application: new Date('2099-01-01T12:00').toISOString(),
          technical: new Date('2099-01-02T12:00').toISOString(),
          financial: new Date('2099-01-03T12:00').toISOString(),
        },
      },
    });
  });
  it.each([
    ['2099-01-02T12:00', '2099-01-02T12:00', '2099-01-03T12:00'],
    ['2000-01-01T12:00', '2099-01-02T12:00', '2099-01-03T12:00'],
  ])('rejects equal or past deadlines', (application, technical, financial) => {
    render(<PublishTenderForm tender={tender} done={vi.fn()} reload={vi.fn()} />, {
      wrapper: ManagementTestProvider,
    });
    fillDeadlines(application, technical, financial);
    fireEvent.click(screen.getByRole('button', { name: 'Publish tender' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it('requires explicit publication confirmation', () => {
    render(<PublishTenderForm tender={tender} done={vi.fn()} reload={vi.fn()} />, {
      wrapper: ManagementTestProvider,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish tender' }));
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
