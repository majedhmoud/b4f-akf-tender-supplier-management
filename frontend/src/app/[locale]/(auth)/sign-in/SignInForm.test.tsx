import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/mutator';
import messages from '@/messages/en.json';
import { SignInForm } from './SignInForm';

// Protects translated errors, retained values, rate limiting, and safe redirects.
const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  mutateAsync: vi.fn(),
  establish: vi.fn(),
  search: new URLSearchParams(),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => mocks.search }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/lib/useSession', () => ({
  useSession: () => ({ establish: mocks.establish, session: null, isLoading: false }),
}));
vi.mock('@/lib/api/generated/auth/auth', () => ({
  useAuthSignIn: () => ({ mutateAsync: mocks.mutateAsync }),
}));
function mount() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SignInForm />
    </NextIntlClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'employee@akf-demo.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'bad-password' } });
}
function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('SignInForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = new URLSearchParams();
    mocks.establish.mockResolvedValue(undefined);
    mocks.mutateAsync.mockResolvedValue({
      user: { id: 'u-1', roles: ['employee'], preferredLanguage: 'ar' },
      supplier: null,
    });
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    ['INVALID_CREDENTIALS', 'The email or password is incorrect.'],
    ['ACCOUNT_PENDING_SETUP', 'Use the setup link in your email to activate your account.'],
    ['ACCOUNT_DISABLED', 'This account is disabled.'],
  ])('translates %s and keeps the form contents', async (code, text) => {
    mocks.mutateAsync.mockRejectedValue(
      new ApiError(403, { error: { code, message: 'Do not show this' } }),
    );
    mount();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.queryByText('Do not show this')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('employee@akf-demo.test');
    expect(screen.getByLabelText('Password')).toHaveValue('bad-password');
  });

  it('translates VALIDATION_FAILED field errors', async () => {
    mocks.mutateAsync.mockRejectedValue(
      new ApiError(400, {
        error: {
          code: 'VALIDATION_FAILED',
          fields: [
            { field: 'email', code: 'isEmail' },
            { field: 'password', code: 'REQUIRED' },
          ],
        },
      }),
    );
    mount();
    submit();
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('This field is required.')).toBeInTheDocument();
  });

  it('disables the button until Retry-After passes', async () => {
    vi.useFakeTimers();
    mocks.mutateAsync.mockRejectedValue(
      new ApiError(429, { error: { code: 'RATE_LIMITED' } }, '2'),
    );
    mount();
    await act(async () => submit());
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('2 seconds');
    await act(async () => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it.each([
    ['//evil.example/path', '/employee/tenders'],
    ['https://evil.example', '/employee/tenders'],
    ['/ar/sign-in', '/employee/tenders'],
    ['/manage/tenders', '/employee/tenders'],
    ['/en/employee/tenders?status=draft', '/employee/tenders?status=draft'],
  ])('checks returnTo %s and switches to preferred language', async (returnTo, destination) => {
    mocks.search = new URLSearchParams({ returnTo });
    mount();
    submit();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(destination, { locale: 'ar' }));
    expect(mocks.establish).toHaveBeenCalled();
  });

  it('sends officers to tender management', async () => {
    mocks.mutateAsync.mockResolvedValue({
      user: { id: 'u-2', roles: ['procurement_officer'], preferredLanguage: 'en' },
    });
    mount();
    submit();
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith('/manage/tenders', { locale: 'en' }),
    );
  });
});
