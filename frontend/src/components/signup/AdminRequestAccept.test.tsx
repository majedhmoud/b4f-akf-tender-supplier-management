import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/mutator';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';
import { AdminRequestDetail } from './ApplicationDetail';
import { application } from './signupTestUtils';

// U7: admin-only writes, translated outcomes, private cache invalidation and duplicate-click prevention.
const mocks = vi.hoisted(() => ({
  accept: vi.fn(),
  refetch: vi.fn(),
  roles: ['admin'] as string[],
  invisible: false,
}));
vi.mock('@/lib/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'u-1', roles: mocks.roles } } }),
}));
vi.mock('@/i18n/navigation', () => ({
  Link: (props: React.ComponentProps<'a'>) => <a {...props} />,
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ applicationId: 'a-1' }) }));
vi.mock('@/lib/api/generated/sign-up/sign-up', () => ({
  useSignupRequestsAccept: () => ({ mutateAsync: mocks.accept, isPending: false }),
  useSignupRequestsDetail: () => ({
    data: {
      ...application,
      review: { decision: 'accepted', reason: null, decidedAt: application.submittedAt },
    },
    isPending: false,
    isError: mocks.invisible,
    error: mocks.invisible ? new ApiError(404, { error: { code: 'NOT_FOUND' } }) : null,
    refetch: mocks.refetch,
  }),
}));
function mount(locale: 'en' | 'ar' = 'en') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const keys = {
    enQueue: ['me', 'u-1', 'signup', 'en', 'admin-queue', 1],
    arQueue: ['me', 'u-1', 'signup', 'ar', 'admin-queue', 2],
    detail: ['me', 'u-1', 'signup', locale, 'admin-detail', 'a-1'],
    otherUser: ['me', 'u-2', 'signup', 'en', 'admin-queue', 1],
    otherDetail: ['me', 'u-1', 'signup', 'en', 'admin-detail', 'a-2'],
  };
  Object.values(keys).forEach((key) => client.setQueryData(key, {}));
  const view = render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en}>
        <AdminRequestDetail applicationId="a-1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { client, keys, ...view };
}
describe('Admin request acceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.roles = ['admin'];
    mocks.invisible = false;
    mocks.accept.mockResolvedValue({
      supplierId: 's-1',
      accountStatus: 'pending_setup',
      setupEmail: { language: 'ar', status: 'sending' },
    });
    mocks.refetch.mockResolvedValue({ error: new ApiError(404, { error: { code: 'NOT_FOUND' } }) });
  });
  it.each(['en', 'ar'] as const)('reports acceptance and pending email in %s', async (locale) => {
    const { client, keys } = mount(locale);
    const messages = locale === 'ar' ? ar : en;
    fireEvent.click(screen.getByRole('button', { name: messages.Signup.adminAccept }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      locale === 'ar'
        ? 'تم القبول — جارٍ إرسال رسالة تهيئة الحساب باللغة العربية.'
        : 'Accepted — a setup email is being sent in Arabic.',
    );
    expect(mocks.accept).toHaveBeenCalledWith({ applicationId: 'a-1' });
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledOnce());
    for (const key of [keys.enQueue, keys.arQueue, keys.detail])
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of [keys.otherUser, keys.otherDetail])
      expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(
      screen.queryByRole('button', { name: messages.Signup.adminAccept }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject|رفض/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Register.pdf')).not.toBeInTheDocument();
  });
  it.each(['en', 'ar'] as const)(
    'translates all U7 conflicts and refetches in %s',
    async (locale) => {
      const messages = locale === 'ar' ? ar : en;
      for (const [code, expected] of [
        ['ALREADY_ACCEPTED', messages.Signup.alreadyAccepted],
        ['EMAIL_ALREADY_REGISTERED', messages.Signup.emailRegistered],
        ['REGISTRATION_NUMBER_EXISTS', messages.Signup.registrationExists],
      ]) {
        mocks.accept.mockRejectedValueOnce(
          new ApiError(409, {
            error: { code, message: 'private server text', details: { supplierId: 's-1' } },
          }),
        );
        const { unmount } = mount(locale);
        fireEvent.click(screen.getByRole('button', { name: messages.Signup.adminAccept }));
        expect(await screen.findByRole('alert')).toHaveTextContent(expected);
        await waitFor(() => expect(mocks.refetch).toHaveBeenCalled());
        expect(screen.queryByText('private server text')).not.toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        if (code === 'ALREADY_ACCEPTED')
          expect(
            screen.queryByRole('button', { name: messages.Signup.adminAccept }),
          ).not.toBeInTheDocument();
        unmount();
        mocks.refetch.mockClear();
      }
    },
  );
  it('prevents duplicate acceptance while a request is pending', async () => {
    let finish!: (value: unknown) => void;
    mocks.accept.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    const pending = screen.getByRole('button', { name: en.Signup.saving });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(mocks.accept).toHaveBeenCalledOnce();
    await act(async () => finish({ setupEmail: { language: 'en', status: 'sending' } }));
    expect(screen.getByRole('status')).toHaveTextContent('in English');
  });
  it('hides acceptance for a non-admin', () => {
    mocks.roles = ['legal_committee'];
    mount();
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    expect(screen.getByText(en.Signup.notFound)).toBeInTheDocument();
  });
  it('hides acceptance for an invisible request', () => {
    mocks.invisible = true;
    mount();
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    expect(mocks.accept).not.toHaveBeenCalled();
  });
  it('offers a translated retry after an unknown failure without refetching', async () => {
    mocks.accept.mockRejectedValueOnce(new Error('private server text'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.Signup.adminAcceptFailed);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept' })).toBeEnabled());
    expect(mocks.refetch).not.toHaveBeenCalled();
    expect(screen.queryByText('private server text')).not.toBeInTheDocument();
  });
});
