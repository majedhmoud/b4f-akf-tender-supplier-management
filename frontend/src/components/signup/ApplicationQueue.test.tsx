import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSignupReviewsList, useSignupRequestsList } from '@/lib/api/generated/sign-up/sign-up';
import { LegalReviewQueue, AdminRequestQueue } from './ApplicationQueue';
import { SignupTestProvider, page } from './signupTestUtils';
const mocks = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('page=1') }));
vi.mock('@/lib/useSession', () => ({ useSession: () => ({ session: { user: { id: 'u-1' } } }) }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/lib/api/generated/sign-up/sign-up', () => ({
  useSignupReviewsList: vi.fn(),
  useSignupRequestsList: vi.fn(),
}));
describe('Sign-up queues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const hook of [useSignupReviewsList, useSignupRequestsList])
      vi.mocked(hook).mockReturnValue({
        data: page,
        isPending: false,
        isError: false,
      } as unknown as ReturnType<typeof hook>);
  });
  it('uses only the legal endpoint and a user/locale-specific key', () => {
    render(<LegalReviewQueue />, { wrapper: SignupTestProvider });
    expect(useSignupRequestsList).not.toHaveBeenCalled();
    expect(useSignupReviewsList).toHaveBeenCalledWith(
      { status: 'pending', page: 1, limit: 20 },
      {
        query: {
          queryKey: ['me', 'u-1', 'signup', 'en', 'legal-queue', 1],
          enabled: true,
          retry: false,
        },
      },
    );
    const links = screen.getAllByRole('link', { name: 'View application' });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute('href', '/signup-reviews/a-1');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(mocks.replace).toHaveBeenCalledWith({ pathname: '/signup-reviews', query: { page: 2 } });
  });
  it('uses only the admin endpoint for raised requests', () => {
    render(<AdminRequestQueue />, { wrapper: SignupTestProvider });
    expect(useSignupReviewsList).not.toHaveBeenCalled();
    expect(useSignupRequestsList).toHaveBeenCalledWith(
      { status: 'raised', page: 1, limit: 20 },
      {
        query: {
          queryKey: ['me', 'u-1', 'signup', 'en', 'admin-queue', 1],
          enabled: true,
          retry: false,
        },
      },
    );
    const links = screen.getAllByRole('link', { name: 'View application' });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute('href', '/signup-requests/a-1');
  });
  it('renders an empty queue and retryable error state', () => {
    vi.mocked(useSignupReviewsList).mockReturnValue({
      data: { ...page, data: [] },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSignupReviewsList>);
    const view = render(<LegalReviewQueue />, { wrapper: SignupTestProvider });
    expect(screen.getByText('There are no requests in this queue.')).toBeInTheDocument();
    const refetch = vi.fn();
    vi.mocked(useSignupReviewsList).mockReturnValue({
      isPending: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useSignupReviewsList>);
    view.rerender(<LegalReviewQueue />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
