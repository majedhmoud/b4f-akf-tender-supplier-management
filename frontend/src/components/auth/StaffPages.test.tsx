import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffLayout from '@/app/[locale]/(staff)/layout';
import ListPage from '@/app/[locale]/(staff)/employee/tenders/page';
import NewPage from '@/app/[locale]/(staff)/employee/tenders/new/page';
import DetailPage from '@/app/[locale]/(staff)/employee/tenders/[tenderId]/page';
import EditPage from '@/app/[locale]/(staff)/employee/tenders/[tenderId]/edit/page';
import OfficerPage from '@/app/[locale]/(staff)/manage/tenders/page';
import OfficerDetailPage from '@/app/[locale]/(staff)/manage/tenders/[tenderId]/page';
import BidFormPage from '@/app/[locale]/(staff)/manage/tenders/[tenderId]/bid-form/page';
import LegalQueuePage from '@/app/[locale]/(staff)/signup-reviews/page';
import LegalDetailPage from '@/app/[locale]/(staff)/signup-reviews/[applicationId]/page';
import AdminQueuePage from '@/app/[locale]/(staff)/signup-requests/page';
import AdminDetailPage from '@/app/[locale]/(staff)/signup-requests/[applicationId]/page';
import messages from '@/messages/en.json';

// The layout must not drop route segments; each page independently gates its content.
const mocks = vi.hoisted(() => ({
  pathname: '/employee/tenders',
  roles: [] as string[],
  replace: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock('@/lib/useSession', () => ({
  useSession: () => ({
    session: { user: { roles: mocks.roles } },
    isLoading: false,
    error: null,
    retry: vi.fn(),
  }),
}));
vi.mock('@/components/employee/EmployeeTenderList', () => ({
  EmployeeTenderList: () => <p>Private list</p>,
}));
vi.mock('@/components/employee/DraftTenderForm', () => ({
  DraftTenderForm: () => <p>Private form</p>,
}));
vi.mock('@/components/employee/EmployeeTenderDetail', () => ({
  EmployeeTenderFromRoute: () => <p>Private detail</p>,
}));
vi.mock('@/components/manage/ManagedTenderList', () => ({
  ManagedTenderList: () => <p>Officer list</p>,
}));
vi.mock('@/components/manage/ManagedTenderDetail', () => ({
  ManagedTenderFromRoute: () => <p>Officer detail</p>,
}));
vi.mock('@/components/manage/BidFormEditor', () => ({
  BidFormFromRoute: () => <p>Officer bid form</p>,
}));
vi.mock('@/components/signup/ApplicationQueue', () => ({
  LegalReviewQueue: () => <p>Legal queue</p>,
  AdminRequestQueue: () => <p>Admin queue</p>,
}));
vi.mock('@/components/signup/ApplicationDetail', () => ({
  LegalApplicationFromRoute: () => <p>Legal detail</p>,
  AdminRequestFromRoute: () => <p>Admin detail</p>,
}));
const pages = [
  { Page: ListPage, path: '/employee/tenders', role: 'employee', text: 'Private list' },
  { Page: NewPage, path: '/employee/tenders/new', role: 'employee', text: 'Private form' },
  { Page: DetailPage, path: '/employee/tenders/t-1', role: 'employee', text: 'Private detail' },
  { Page: EditPage, path: '/employee/tenders/t-1/edit', role: 'employee', text: 'Private detail' },
  {
    Page: OfficerPage,
    path: '/manage/tenders',
    role: 'procurement_officer',
    text: 'Officer list',
  },
  {
    Page: OfficerDetailPage,
    path: '/manage/tenders/t-1',
    role: 'procurement_officer',
    text: 'Officer detail',
  },
  {
    Page: BidFormPage,
    path: '/manage/tenders/t-1/bid-form',
    role: 'procurement_officer',
    text: 'Officer bid form',
  },
  { Page: LegalQueuePage, path: '/signup-reviews', role: 'legal_committee', text: 'Legal queue' },
  {
    Page: LegalDetailPage,
    path: '/signup-reviews/a-1',
    role: 'legal_committee',
    text: 'Legal detail',
  },
  { Page: AdminQueuePage, path: '/signup-requests', role: 'admin', text: 'Admin queue' },
  { Page: AdminDetailPage, path: '/signup-requests/a-1', role: 'admin', text: 'Admin detail' },
];
function mount(Page: () => React.ReactNode) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <StaffLayout>
        <Page />
      </StaffLayout>
    </NextIntlClientProvider>,
  );
}
describe('Staff route boundaries', () => {
  beforeEach(() => {
    mocks.roles = [];
    mocks.replace.mockReset();
  });
  it('includes the child segment in server output without a session-dependent layout', () => {
    expect(
      renderToString(
        <StaffLayout>
          <p>Route segment</p>
        </StaffLayout>,
      ),
    ).toContain('Route segment');
  });
  it.each(pages)('guards $path before rendering private content', async ({ Page, path, text }) => {
    mocks.pathname = path;
    mount(Page);
    expect(screen.queryByText(text)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        { pathname: '/sign-in', query: { returnTo: path } },
        { locale: 'en' },
      ),
    );
  });
  it.each(pages)('renders $path for its permitted role', ({ Page, path, role, text }) => {
    mocks.pathname = path;
    mocks.roles = [role];
    mount(Page);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
