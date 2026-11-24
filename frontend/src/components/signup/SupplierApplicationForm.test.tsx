import { useMutation } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupplierApplicationsSubmitBody } from '@/lib/api/generated/model';
import { useLocale } from 'next-intl';
import { ApiError } from '@/lib/api/mutator';
import { SupplierApplicationForm } from './SupplierApplicationForm';
import { SignupTestProvider, form } from './signupTestUtils';
const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  keys: [] as string[],
  session: null as object | null,
}));
vi.mock('@/lib/useSession', () => ({
  useSession: () => ({ session: mocks.session, isLoading: false, error: null }),
}));
vi.mock('@/lib/api/generated/reference/reference', () => ({
  useSignupFormForm: () => ({ data: form, isPending: false, isError: false }),
}));
vi.mock('@/lib/api/generated/sign-up/sign-up', () => ({
  useSupplierApplicationsSubmit: (options: { request: { headers: Headers } }) =>
    useMutation({
      retry: false,
      mutationFn: ({ data }: { data: SupplierApplicationsSubmitBody }) => {
        mocks.keys.push(options.request.headers.get('Idempotency-Key')!);
        return mocks.submit(data);
      },
    }),
}));
vi.mock('@/i18n/navigation', () => ({
  Link: function TestLink({ children, href }: { children: React.ReactNode; href: string }) {
    const locale = useLocale();
    return <a href={`/${locale}${href}`}>{children}</a>;
  },
}));
function complete() {
  fireEvent.change(screen.getByLabelText('Legal name'), { target: { value: 'Al-Noor' } });
  fireEvent.change(screen.getByLabelText('Registration number'), { target: { value: 'CR-1' } });
  fireEvent.change(screen.getByLabelText('Contact email'), {
    target: { value: 'supplier@example.test' },
  });
  for (const label of ['Registration certificate', 'Tax certificate'])
    fireEvent.change(screen.getByLabelText(label), {
      target: { files: [new File(['%PDF-1.7'], label + '.pdf', { type: 'application/pdf' })] },
    });
}
function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Submit for legal review' }));
}
describe('SupplierApplicationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.keys = [];
    mocks.session = null;
    mocks.submit.mockResolvedValue({ applicationId: 'a-1', submittedAt: '2026-11-24T00:00:00Z' });
  });
  afterEach(() => vi.useRealTimers());
  it('submits all required multipart fields with a fresh UUID action key', async () => {
    render(<SupplierApplicationForm />, { wrapper: SignupTestProvider });
    complete();
    submit();
    expect(await screen.findByRole('status')).toHaveTextContent('Submitted for legal review');
    expect(JSON.parse(mocks.submit.mock.calls[0][0].application)).toEqual({
      legalName: 'Al-Noor',
      registrationNumber: 'CR-1',
      contactEmail: 'supplier@example.test',
      preferredLanguage: 'en',
    });
    expect(mocks.submit.mock.calls[0][0]['files[tax_certificate]']).toBeInstanceOf(File);
    expect(mocks.keys[0]).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('keeps both input and key on an ambiguous failure, then reuses the key on retry', async () => {
    mocks.submit.mockRejectedValueOnce(new Error('network'));
    render(<SupplierApplicationForm />, { wrapper: SignupTestProvider });
    complete();
    submit();
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Legal name')).toHaveValue('Al-Noor');
    submit();
    await screen.findByRole('status');
    expect(mocks.keys).toHaveLength(2);
    expect(mocks.keys[1]).toBe(mocks.keys[0]);
  });
  it('generates a new key only after a deliberate edit', async () => {
    mocks.submit.mockRejectedValueOnce(new Error('network'));
    render(<SupplierApplicationForm />, { wrapper: SignupTestProvider });
    complete();
    submit();
    await screen.findByRole('alert');
    fireEvent.change(screen.getByLabelText('Legal name'), { target: { value: 'Changed company' } });
    submit();
    await screen.findByRole('status');
    expect(mocks.keys[1]).not.toBe(mocks.keys[0]);
  });
  it('validates required files and legal information before sending', () => {
    render(<SupplierApplicationForm />, { wrapper: SignupTestProvider });
    submit();
    expect(screen.getAllByText('This field is required.').length).toBeGreaterThan(1);
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it('rejects unsupported uploads before sending', () => {
    render(<SupplierApplicationForm />, { wrapper: SignupTestProvider });
    complete();
    fireEvent.change(screen.getByLabelText('Tax certificate'), {
      target: { files: [new File(['x'], 'program.exe')] },
    });
    submit();
    expect(
      screen.getByText('Choose a supported, non-empty file of at most 20 MB.'),
    ).toBeInTheDocument();
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it('maps registered numbers and server field errors without showing server messages', async () => {
    mocks.submit.mockRejectedValueOnce(
      new ApiError(409, { error: { code: 'REGISTRATION_NUMBER_EXISTS', message: 'do not show' } }),
    );
    render(<SupplierApplicationForm />, { wrapper: SignupTestProvider });
    complete();
    submit();
    await screen.findByRole('alert');
    expect(screen.getByLabelText(/^Registration number/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('do not show')).not.toBeInTheDocument();
  });
  it('enforces the one-second in-progress wait and retains the request key', async () => {
    mocks.submit.mockRejectedValueOnce(
      new ApiError(409, { error: { code: 'IDEMPOTENCY_IN_PROGRESS' } }),
    );
    render(<SupplierApplicationForm />, { wrapper: SignupTestProvider });
    complete();
    submit();
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled();
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Submit for legal review' })).toBeEnabled(),
      { timeout: 2000 },
    );
    submit();
    await screen.findByRole('status');
    expect(mocks.keys[1]).toBe(mocks.keys[0]);
  });
  it.each(['en', 'ar'] as const)(
    'preserves input and offers localized sign-in for an existing email in %s',
    async (locale) => {
      mocks.submit.mockRejectedValueOnce(
        new ApiError(409, {
          error: {
            code: 'EMAIL_ALREADY_REGISTERED',
            message: 'Do not display server text',
            fields: [{ field: 'contactEmail', code: 'EMAIL_ALREADY_REGISTERED' }],
          },
        }),
      );
      render(
        <SignupTestProvider locale={locale}>
          <SupplierApplicationForm />
        </SignupTestProvider>,
      );
      if (locale === 'en') complete();
      else {
        fireEvent.change(screen.getByLabelText('الاسم القانوني'), { target: { value: 'Al-Noor' } });
        fireEvent.change(screen.getByLabelText('رقم التسجيل'), { target: { value: 'CR-1' } });
        fireEvent.change(screen.getByLabelText('البريد الإلكتروني للتواصل'), {
          target: { value: 'supplier@example.test' },
        });
        for (const label of ['شهادة التسجيل', 'الشهادة الضريبية'])
          fireEvent.change(screen.getByLabelText(label), {
            target: {
              files: [new File(['%PDF-1.7'], 'certificate.pdf', { type: 'application/pdf' })],
            },
          });
      }
      fireEvent.click(
        screen.getByRole('button', {
          name: locale === 'ar' ? 'إرسال للمراجعة القانونية' : 'Submit for legal review',
        }),
      );
      const link = await screen.findByRole('link', {
        name: locale === 'ar' ? 'سجّل الدخول بدلاً من ذلك' : 'Sign in instead',
      });
      expect(link).toHaveAttribute('href', `/${locale}/sign-in`);
      const email = screen.getByLabelText(
        locale === 'ar' ? /^البريد الإلكتروني للتواصل/ : /^Contact email/,
      );
      expect(email).toHaveValue('supplier@example.test');
      expect(email).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(locale === 'ar' ? 'الاسم القانوني' : 'Legal name')).toHaveValue(
        'Al-Noor',
      );
      expect(
        (
          screen.getByLabelText(
            locale === 'ar' ? 'الشهادة الضريبية' : 'Tax certificate',
          ) as HTMLInputElement
        ).files,
      ).toHaveLength(1);
      expect(screen.queryByText('Do not display server text')).not.toBeInTheDocument();
      expect(mocks.submit).toHaveBeenCalledOnce();
    },
  );
  it('uses the latest R2 limits for registration number and contact email', () => {
    render(<SupplierApplicationForm />, { wrapper: SignupTestProvider });
    expect(screen.getByLabelText('Registration number')).toHaveAttribute('maxlength', '100');
    expect(screen.getByLabelText('Contact email')).toHaveAttribute('maxlength', '254');
  });
  it('disables submission for the full Retry-After period on RATE_LIMITED', async () => {
    mocks.submit.mockRejectedValueOnce(new ApiError(429, { error: { code: 'RATE_LIMITED' } }, '2'));
    render(<SupplierApplicationForm />, { wrapper: SignupTestProvider });
    complete();
    submit();
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled();
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Submit for legal review' })).toBeEnabled(),
      { timeout: 3000 },
    );
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    submit();
    await screen.findByRole('status');
    expect(mocks.keys[1]).toBe(mocks.keys[0]);
  });
  it('keeps signed-in users out of the guest form', () => {
    mocks.session = { user: { id: 'u-1' } };
    render(<SupplierApplicationForm />, { wrapper: SignupTestProvider });
    expect(screen.getByText('Supplier applications are for guests.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Submit for legal review' }),
    ).not.toBeInTheDocument();
  });
  it('renders Arabic labels and defaults the preferred language to Arabic', () => {
    render(
      <SignupTestProvider locale="ar">
        <SupplierApplicationForm />
      </SignupTestProvider>,
    );
    expect(screen.getByRole('heading', { name: 'تسجيل مورد' })).toBeInTheDocument();
    expect(screen.getByLabelText('اللغة المفضلة')).toHaveValue('ar');
    expect(screen.getByLabelText('البريد الإلكتروني للتواصل')).toHaveAttribute('dir', 'ltr');
  });
});
