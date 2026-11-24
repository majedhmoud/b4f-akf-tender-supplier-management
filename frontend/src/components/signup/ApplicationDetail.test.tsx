import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useLegalApplicationsDetail,
  useSignupRequestsDetail,
} from '@/lib/api/generated/sign-up/sign-up';
import { ApiError } from '@/lib/api/mutator';
import { LegalApplicationDetail, AdminRequestDetail, LegalDecisionForm } from './ApplicationDetail';
import { SignupTestProvider, application } from './signupTestUtils';
const mocks = vi.hoisted(() => ({
  review: vi.fn(),
  download: vi.fn(),
  accept: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ applicationId: 'a-1' }) }));
vi.mock('@/lib/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'u-1', roles: ['admin'] } } }),
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/lib/api/generated/sign-up/sign-up', () => ({
  useLegalApplicationsDetail: vi.fn(),
  useSignupRequestsDetail: vi.fn(),
  useSignupRequestsAccept: () => ({ mutateAsync: mocks.accept, isPending: false }),
  useLegalApplicationsReview: () => ({ mutateAsync: mocks.review, isPending: false }),
  useLegalApplicationsDownload: () => ({ refetch: mocks.download, isFetching: false }),
}));
function decide(value = 'accepted') {
  fireEvent.change(screen.getByLabelText('Decision'), { target: { value } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Submit decision' }));
}
describe('Sign-up details and decisions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.review.mockResolvedValue({
      decision: 'accepted',
      raisedToAdminAt: '2026-11-24T01:00:00Z',
    });
    vi.mocked(useLegalApplicationsDetail).mockReturnValue({
      data: application,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useLegalApplicationsDetail>);
    vi.mocked(useSignupRequestsDetail).mockReturnValue({
      refetch: mocks.refetch,
      data: {
        ...application,
        documents: undefined,
        review: {
          decision: 'accepted',
          reviewerUserId: 'legal',
          reason: 'Checked',
          decidedAt: '2026-11-24T01:00:00Z',
          raisedToAdminAt: '2026-11-24T01:00:00Z',
        },
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSignupRequestsDetail>);
  });
  it('requires a decision and confirmation, then records acceptance once', async () => {
    render(<LegalDecisionForm applicationId="a-1" />, { wrapper: SignupTestProvider });
    expect(screen.getByRole('button', { name: 'Submit decision' })).toBeDisabled();
    decide();
    expect(await screen.findByRole('status')).toHaveTextContent('raised to the admin');
    expect(mocks.review).toHaveBeenCalledWith({
      applicationId: 'a-1',
      data: { decision: 'accepted', reason: null },
    });
    expect(screen.queryByRole('button', { name: 'Submit decision' })).not.toBeInTheDocument();
  });
  it('shows rejection as final and retains the optional note in the request', async () => {
    mocks.review.mockResolvedValue({ decision: 'rejected', raisedToAdminAt: null });
    render(<LegalDecisionForm applicationId="a-1" />, { wrapper: SignupTestProvider });
    fireEvent.change(screen.getByLabelText('Review note (optional)'), {
      target: { value: 'Invalid registration' },
    });
    decide('rejected');
    expect(await screen.findByRole('status')).toHaveTextContent('No account has been created');
    expect(mocks.review.mock.calls[0][0].data.reason).toBe('Invalid registration');
  });
  it('uses the saved decision from ALREADY_SUBMITTED rather than the attempted one', async () => {
    mocks.review.mockRejectedValue(
      new ApiError(409, {
        error: { code: 'ALREADY_SUBMITTED', details: { decision: 'accepted' } },
      }),
    );
    render(<LegalDecisionForm applicationId="a-1" />, { wrapper: SignupTestProvider });
    decide('rejected');
    expect(await screen.findByRole('status')).toHaveTextContent('Accepted');
    expect(screen.getByRole('status')).not.toHaveTextContent('Rejected');
  });
  it('does not invent a decision if the conflict response has no decision', async () => {
    mocks.review.mockRejectedValue(
      new ApiError(409, { error: { code: 'ALREADY_SUBMITTED', details: {} } }),
    );
    render(<LegalDecisionForm applicationId="a-1" />, { wrapper: SignupTestProvider });
    decide();
    expect(await screen.findByRole('status')).toHaveTextContent('already been recorded');
    expect(screen.getByRole('status')).not.toHaveTextContent('Accepted');
  });
  it('preserves the note after an unconfirmed failure and translates the error', async () => {
    mocks.review.mockRejectedValue(new Error('server internals'));
    render(<LegalDecisionForm applicationId="a-1" />, { wrapper: SignupTestProvider });
    fireEvent.change(screen.getByLabelText('Review note (optional)'), {
      target: { value: 'Keep this' },
    });
    decide();
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Review note (optional)')).toHaveValue('Keep this');
    expect(screen.queryByText('server internals')).not.toBeInTheDocument();
  });
  it('limits review notes to 2000 characters before sending', () => {
    render(<LegalDecisionForm applicationId="a-1" />, { wrapper: SignupTestProvider });
    expect(screen.getByLabelText('Review note (optional)')).toHaveAttribute('maxlength', '2000');
    fireEvent.change(screen.getByLabelText('Review note (optional)'), {
      target: { value: 'x'.repeat(2001) },
    });
    decide();
    expect(screen.getByRole('alert')).toHaveTextContent('Check the indicated fields.');
    expect(mocks.review).not.toHaveBeenCalled();
  });
  it('maps a server reason validation error to the note without discarding it', async () => {
    mocks.review.mockRejectedValueOnce(
      new ApiError(400, {
        error: { code: 'VALIDATION_FAILED', fields: [{ field: 'reason', code: 'INVALID' }] },
      }),
    );
    render(<LegalDecisionForm applicationId="a-1" />, { wrapper: SignupTestProvider });
    fireEvent.change(screen.getByLabelText('Review note (optional)'), {
      target: { value: 'Keep this note' },
    });
    decide();
    await screen.findByRole('alert');
    expect(screen.getByLabelText(/^Review note/)).toHaveValue('Keep this note');
    expect(screen.getByLabelText(/^Review note/)).toHaveAttribute('aria-invalid', 'true');
  });
  it('shows a legal file download failure without revealing server data', async () => {
    mocks.download.mockResolvedValue({ error: new Error('network') });
    render(<LegalApplicationDetail applicationId="a-1" />, { wrapper: SignupTestProvider });
    expect(useSignupRequestsDetail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be downloaded');
  });
  it('shows the admin detail with acceptance only, without downloads or editing', () => {
    render(<AdminRequestDetail applicationId="a-1" />, { wrapper: SignupTestProvider });
    expect(useLegalApplicationsDetail).not.toHaveBeenCalled();
    expect(screen.getByText('Checked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Register.pdf')).not.toBeInTheDocument();
    expect(useSignupRequestsDetail).toHaveBeenCalledWith('a-1', {
      query: {
        queryKey: ['me', 'u-1', 'signup', 'en', 'admin-detail', 'a-1'],
        enabled: true,
        retry: false,
      },
    });
  });
  it('hides all application content on an invisible record', () => {
    vi.mocked(useLegalApplicationsDetail).mockReturnValue({
      isPending: false,
      isError: true,
      error: new ApiError(404, { error: { code: 'NOT_FOUND' } }),
    } as unknown as ReturnType<typeof useLegalApplicationsDetail>);
    render(<LegalApplicationDetail applicationId="a-1" />, { wrapper: SignupTestProvider });
    expect(
      screen.getByText('This application is not available to your account.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Al-Noor')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit decision' })).not.toBeInTheDocument();
  });
});
