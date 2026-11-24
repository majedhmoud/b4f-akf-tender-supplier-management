import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/mutator';
import { BidFormFields } from './BidFormEditor';
import { ManagementTestProvider, form } from './managementTestUtils';

// The complete ordered template preserves IDs; standard inputs never enter PUT.
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('next/navigation', () => ({ useParams: () => ({ tenderId: 't-1' }) }));
vi.mock('@/lib/api/generated/tender-management/tender-management', () => ({
  useManageTendersSaveBidForm: () => ({ mutateAsync: mocks.save }),
}));
vi.mock('@/i18n/navigation', () => ({ Link: () => null }));
function mount(view = form) {
  const done = vi.fn().mockResolvedValue(undefined);
  const reload = vi.fn().mockResolvedValue(undefined);
  render(<BidFormFields tenderId="t-1" view={view} done={done} reload={reload} />, {
    wrapper: ManagementTestProvider,
  });
  return { done, reload };
}
function addLegal() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Add custom field' })[0]);
}
function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save supplier bid form' }));
}
describe('Supplier bid form editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.save.mockResolvedValue(form);
  });
  it('saves a bilingual numeric field with all three parts and no invented ID', async () => {
    const { done } = mount();
    addLegal();
    fireEvent.change(screen.getByLabelText('Field type'), { target: { value: 'number' } });
    fireEvent.change(screen.getByLabelText('English label'), {
      target: { value: 'Years trading' },
    });
    fireEvent.change(screen.getByLabelText('Arabic label'), { target: { value: 'سنوات العمل' } });
    fireEvent.change(screen.getByLabelText('Unit (Optional)'), { target: { value: 'years' } });
    fireEvent.change(screen.getByLabelText('Minimum (Optional)'), { target: { value: '2' } });
    fireEvent.click(screen.getByLabelText('Required'));
    save();
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(mocks.save).toHaveBeenCalledWith({
      tenderId: 't-1',
      data: {
        revision: 5,
        parts: [
          {
            partType: 'legal_information',
            customFields: [
              {
                type: 'number',
                required: true,
                unit: 'years',
                minimum: 2,
                translations: [
                  { language: 'en', label: 'Years trading', instructions: '' },
                  { language: 'ar', label: 'سنوات العمل', instructions: '' },
                ],
              },
            ],
          },
          { partType: 'technical_offer', customFields: [] },
          { partType: 'financial_offer', customFields: [] },
        ],
      },
    });
  });
  it.each(['text', 'boolean', 'file'])(
    'supports %s fields with Arabic-only labels',
    async (type) => {
      mount();
      addLegal();
      fireEvent.change(screen.getByLabelText('Field type'), { target: { value: type } });
      fireEvent.change(screen.getByLabelText('Arabic label'), { target: { value: 'حقل إضافي' } });
      save();
      await waitFor(() => expect(mocks.save).toHaveBeenCalled());
      expect(mocks.save.mock.calls[0][0].data.parts[0].customFields[0]).toEqual({
        type,
        required: false,
        translations: [{ language: 'ar', label: 'حقل إضافي', instructions: '' }],
      });
    },
  );
  it('rejects a custom field without a label', () => {
    mount();
    addLegal();
    save();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('omits numeric-only settings after changing field type', async () => {
    mount();
    addLegal();
    fireEvent.change(screen.getByLabelText('English label'), { target: { value: 'Memory' } });
    fireEvent.change(screen.getByLabelText('Field type'), { target: { value: 'number' } });
    fireEvent.change(screen.getByLabelText('Minimum (Optional)'), { target: { value: '16' } });
    fireEvent.change(screen.getByLabelText('Field type'), { target: { value: 'text' } });
    save();
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][0].data.parts[0].customFields[0]).not.toHaveProperty('minimum');
  });
  it('retains server IDs when reordering and removes omitted fields', async () => {
    const custom = ['one', 'two'].map((fieldId) => ({
      fieldId,
      type: 'text' as const,
      required: false,
      unit: null,
      minimum: null,
      translations: [{ language: 'en' as const, label: fieldId }],
    }));
    mount({
      ...form,
      parts: form.parts.map((part, index) =>
        index === 0 ? { ...part, customFields: custom } : part,
      ),
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
    expect(screen.getAllByLabelText('English label')[0]).toHaveValue('two');
    expect(screen.getAllByLabelText('English label')[1]).toHaveValue('one');
    save();
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(
      mocks.save.mock.calls[0][0].data.parts[0].customFields.map(
        (field: { fieldId: string }) => field.fieldId,
      ),
    ).toEqual(['two', 'one']);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove field' })[0]);
    save();
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect(
      mocks.save.mock.calls[1][0].data.parts[0].customFields.map(
        (field: { fieldId: string }) => field.fieldId,
      ),
    ).toEqual(['one']);
  });
  it('preserves field input on conflict and exposes explicit reload', async () => {
    mocks.save.mockRejectedValue(new ApiError(409, { error: { code: 'VERSION_CONFLICT' } }));
    const { reload } = mount();
    addLegal();
    fireEvent.change(screen.getByLabelText('English label'), { target: { value: 'Keep this' } });
    save();
    await screen.findByRole('alert');
    expect(screen.getByLabelText('English label')).toHaveValue('Keep this');
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload and discard my changes' }));
    expect(reload).toHaveBeenCalledOnce();
  });
  it('shows published templates without editing controls', () => {
    mount({ ...form, allowedActions: [] });
    expect(screen.queryByRole('button', { name: 'Add custom field' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save supplier bid form' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('read-only');
    expect(screen.getByText('Registration certificate', { exact: false })).toBeInTheDocument();
  });
  it('renders the Arabic form with right-to-left bilingual field groups', () => {
    render(
      <ManagementTestProvider locale="ar">
        <BidFormFields tenderId="t-1" view={form} done={vi.fn()} reload={vi.fn()} />
      </ManagementTestProvider>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'إضافة حقل مخصص' })[0]);
    expect(screen.getByLabelText('التسمية بالعربية').closest('[dir]')).toHaveAttribute(
      'dir',
      'rtl',
    );
  });
});
