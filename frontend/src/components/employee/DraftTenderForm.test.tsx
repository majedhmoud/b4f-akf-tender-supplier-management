import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeTender } from '@/lib/api/generated/model';
import { ApiError } from '@/lib/api/mutator';
import messages from '@/messages/en.json';
import arabicMessages from '@/messages/ar.json';
import { DraftTenderForm } from './DraftTenderForm';

// Protects bilingual draft payloads, insert/update separation, and preservation
// of unsaved text on a revision conflict (API_CONTRACT.md Employee Tenders).
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  push: vi.fn(),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/lib/useSession', () => ({ useSession: () => ({ session: { user: { id: 'u-1' } } }) }));
vi.mock('@/lib/api/generated/employee-tenders/employee-tenders', () => ({
  useEmployeeTendersCreate: () => ({ mutateAsync: mocks.create }),
  useEmployeeTendersUpdate: () => ({ mutateAsync: mocks.update }),
}));
vi.mock('@/lib/api/generated/reference/reference', () => ({
  useReferenceCategories: () => ({ data: { data: [{ code: 'construction' }] }, isError: false }),
}));
const initial: EmployeeTender = {
  id: 't-1',
  status: 'draft',
  revision: 4,
  categoryCode: 'construction',
  estimatedBalance: { amount: '100.00', currency: 'USD' },
  translations: [{ language: 'en', title: 'School repairs', description: 'Repair the roof.' }],
  allowedActions: ['edit'],
  documents: [],
  deadlines: null,
  cancellationReason: null,
};
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={messages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}
function complete() {
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'construction' } });
  fireEvent.change(screen.getByLabelText('Estimated balance'), { target: { value: '125000.00' } });
  fireEvent.change(screen.getByLabelText('Currency code'), { target: { value: 'usd' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Title and description' }));
  fireEvent.change(screen.getByLabelText('English title'), { target: { value: 'School repairs' } });
  fireEvent.change(screen.getByLabelText('English description'), {
    target: { value: 'Repair the roof.' },
  });
}
function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
}
describe('DraftTenderForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: 't-2', status: 'draft', revision: 1 });
    mocks.update.mockResolvedValue({ revision: 5 });
  });
  it('preserves unsaved inputs when switching tabs without saving', () => {
    render(<DraftTenderForm initial={initial} />, { wrapper });
    fireEvent.change(screen.getByLabelText('Estimated balance'), { target: { value: '999.00' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Title and description' }));
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    fireEvent.change(screen.getByRole('textbox', { name: 'English title' }), {
      target: { value: 'Unsaved title' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Basic information' }));
    expect(screen.getByRole('textbox', { name: 'Estimated balance' })).toHaveValue('999.00');
    expect(screen.queryByRole('textbox', { name: 'English title' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Title and description' }));
    expect(screen.getByRole('textbox', { name: 'English title' })).toHaveValue('Unsaved title');
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('reveals and focuses basic-field errors when saving from the translations tab', async () => {
    render(<DraftTenderForm initial={initial} />, { wrapper });
    fireEvent.change(screen.getByLabelText('Estimated balance'), { target: { value: 'invalid' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Title and description' }));
    save();
    expect(screen.getByRole('tab', { name: 'Basic information' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Estimated balance' })).toHaveFocus(),
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('reveals missing translation fields when saving from the basic tab', async () => {
    render(<DraftTenderForm initial={{ ...initial, translations: [] }} />, { wrapper });
    save();
    expect(screen.getByRole('tab', { name: 'Title and description' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'English title' })).toHaveFocus(),
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('saves the complete draft including the hidden translation panel', async () => {
    render(<DraftTenderForm />, { wrapper });
    complete();
    fireEvent.click(screen.getByRole('tab', { name: 'Basic information' }));
    save();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create.mock.calls[0][0].data.translations).toEqual([
      { language: 'en', title: 'School repairs', description: 'Repair the roof.' },
    ]);
  });
  it('creates a draft with one complete translation and navigates to its saved details', async () => {
    render(<DraftTenderForm />, { wrapper });
    complete();
    save();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/employee/tenders/t-2'));
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        categoryCode: 'construction',
        estimatedBalance: { amount: '125000.00', currency: 'USD' },
        translations: [
          { language: 'en', title: 'School repairs', description: 'Repair the roof.' },
        ],
      },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('accepts Arabic as the only completed language', async () => {
    render(<DraftTenderForm />, { wrapper });
    complete();
    fireEvent.change(screen.getByLabelText('English title'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('English description'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Arabic title'), { target: { value: 'ترميم مدرسة' } });
    fireEvent.change(screen.getByLabelText('Arabic description'), {
      target: { value: 'ترميم السقف' },
    });
    save();
    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0][0].data.translations).toEqual([
      { language: 'ar', title: 'ترميم مدرسة', description: 'ترميم السقف' },
    ]);
    expect(screen.getByLabelText('Arabic title')).toHaveAttribute('dir', 'rtl');
  });
  it('submits from the Arabic interface with Arabic labels and direction', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="ar" messages={arabicMessages}>
          <DraftTenderForm />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText('الفئة'), { target: { value: 'construction' } });
    fireEvent.change(screen.getByLabelText('الرصيد التقديري'), { target: { value: '100.00' } });
    fireEvent.change(screen.getByLabelText('رمز العملة'), { target: { value: 'USD' } });
    fireEvent.click(screen.getByRole('tab', { name: arabicMessages.Employee.translations }));
    fireEvent.change(screen.getByLabelText('العنوان باللغة العربية'), {
      target: { value: 'ترميم مدرسة' },
    });
    fireEvent.change(screen.getByLabelText('الوصف باللغة العربية'), {
      target: { value: 'ترميم السقف' },
    });
    expect(screen.getByLabelText('العنوان باللغة العربية')).toHaveAttribute('dir', 'rtl');
    fireEvent.click(screen.getByRole('button', { name: 'حفظ المسودة' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/employee/tenders/t-2'));
  });
  it('rejects missing basic values and a missing complete language before writing', () => {
    render(<DraftTenderForm />, { wrapper });
    save();
    expect(
      screen.getByText('Complete the title and description in at least one language.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('requires both fields when a second translation is started', () => {
    render(<DraftTenderForm />, { wrapper });
    complete();
    fireEvent.change(screen.getByLabelText('Arabic title'), { target: { value: 'عنوان' } });
    save();
    expect(screen.getByLabelText('Arabic description')).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('updates with the revision that was opened, retaining it if background data changes', async () => {
    const view = render(<DraftTenderForm initial={initial} />, { wrapper });
    view.rerender(<DraftTenderForm initial={{ ...initial, revision: 9 }} />);
    fireEvent.change(screen.getByLabelText('English title'), { target: { value: 'My edits' } });
    save();
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ tenderId: 't-1', data: { revision: 4 } });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('retains user text after VERSION_CONFLICT and reloads only by explicit action', async () => {
    mocks.update.mockRejectedValue(new ApiError(409, { error: { code: 'VERSION_CONFLICT' } }));
    const reload = vi.fn().mockResolvedValue(undefined);
    render(<DraftTenderForm initial={initial} onReload={reload} />, { wrapper });
    fireEvent.change(screen.getByLabelText('English title'), {
      target: { value: 'My unsaved title' },
    });
    save();
    await screen.findByRole('button', { name: 'Reload and discard my changes' });
    expect(screen.getByLabelText('English title')).toHaveValue('My unsaved title');
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload and discard my changes' }));
    expect(reload).toHaveBeenCalledOnce();
  });
  it('locks further writes after TENDER_STATUS_CHANGED', async () => {
    mocks.update.mockRejectedValue(new ApiError(409, { error: { code: 'TENDER_STATUS_CHANGED' } }));
    render(<DraftTenderForm initial={initial} />, { wrapper });
    save();
    await screen.findByText(/This tender is no longer editable/);
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(screen.getByLabelText('English title')).toBeDisabled();
  });
  it('maps validation errors to the translated field and never displays server messages', async () => {
    mocks.update.mockRejectedValue(
      new ApiError(400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'private error text',
          fields: [{ field: 'translations[0].title', code: 'REQUIRED' }],
        },
      }),
    );
    render(<DraftTenderForm initial={initial} />, { wrapper });
    save();
    await screen.findByText('Check the highlighted fields.');
    expect(screen.getByLabelText('English title')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('tab', { name: 'Title and description' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('textbox', { name: 'English title' })).toHaveFocus();
    expect(screen.queryByText('private error text')).not.toBeInTheDocument();
    expect(screen.getByLabelText('English description')).toHaveValue('Repair the roof.');
  });
});
