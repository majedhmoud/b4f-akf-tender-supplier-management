'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useRouter } from '@/i18n/navigation';
import type { ApplicationPage } from '@/lib/api/generated/model';
import { useSignupReviewsList, useSignupRequestsList } from '@/lib/api/generated/sign-up/sign-up';
import { privateKey } from '@/lib/api/query-keys';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/lib/useSession';
import { listCardActionClass, listCardClass } from '@/components/ui/list-card';

function useQueueState() {
  const search = useSearchParams();
  const locale = useLocale();
  const { session } = useSession();
  const raw = Number(search.get('page'));
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  return { locale, session, page };
}
function ApplicationQueueView({
  admin,
  page,
  data,
  pending,
  failed,
  retry,
}: {
  admin?: boolean;
  page: number;
  data?: ApplicationPage;
  pending: boolean;
  failed: boolean;
  retry: () => void;
}) {
  const t = useTranslations('Signup');
  const locale = useLocale();
  const router = useRouter();
  const path = admin ? '/signup-requests' : '/signup-reviews';
  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{t(admin ? 'adminQueue' : 'legalQueue')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(admin ? 'adminQueueHint' : 'legalQueueHint')}
        </p>
      </header>
      {pending && <Skeleton className="h-64" />}
      {failed && (
        <ErrorState
          title={t('loadFailed')}
          action={<Button onClick={retry}>{t('retry')}</Button>}
        />
      )}
      {data &&
        (data.data.length ? (
          <>
            <ul className="space-y-3 lg:hidden">
              {data.data.map((row) => (
                <li key={row.applicationId} className={listCardClass}>
                  <p className="font-semibold" dir="auto">
                    {row.legalName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span dir="auto">{row.registrationNumber}</span> ·{' '}
                    <time dateTime={row.submittedAt}>
                      {formatDateTime(locale, row.submittedAt)}
                    </time>
                  </p>
                  <Link href={`${path}/${row.applicationId}`} className={listCardActionClass}>
                    {t('view')}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto panel lg:block">
              <table className="w-full text-start text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    {['legalName', 'registrationNumber', 'submittedAt', 'action'].map((key) => (
                      <th className="px-5 py-3 text-start" scope="col" key={key}>
                        {t(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.data.map((row) => (
                    <tr key={row.applicationId}>
                      <td className="min-w-44 px-5 py-5" dir="auto">
                        {row.legalName}
                      </td>
                      <td className="px-5 py-5" dir="auto">
                        {row.registrationNumber}
                      </td>
                      <td className="px-5 py-5">
                        <time dateTime={row.submittedAt}>
                          {formatDateTime(locale, row.submittedAt)}
                        </time>
                      </td>
                      <td className="px-5 py-5">
                        <Link
                          href={`${path}/${row.applicationId}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {t('view')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState title={t('emptyQueue')} />
        ))}
      {data && data.meta.totalPages > 1 && (
        <nav
          aria-label={t('pagination')}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => router.replace({ pathname: path, query: { page: page - 1 } })}
          >
            {t('previous')}
          </Button>
          <span>{t('pageOf', { page, total: data.meta.totalPages })}</span>
          <Button
            variant="outline"
            disabled={page >= data.meta.totalPages}
            onClick={() => router.replace({ pathname: path, query: { page: page + 1 } })}
          >
            {t('next')}
          </Button>
        </nav>
      )}
    </section>
  );
}
export function LegalReviewQueue() {
  const { locale, session, page } = useQueueState();
  const query = useSignupReviewsList(
    { status: 'pending', page, limit: 20 },
    {
      query: {
        queryKey: privateKey(session?.user.id ?? '', ['signup', locale, 'legal-queue', page]),
        enabled: !!session,
        retry: false,
      },
    },
  );
  return (
    <ApplicationQueueView
      page={page}
      data={query.data}
      pending={query.isPending}
      failed={query.isError}
      retry={() => void query.refetch()}
    />
  );
}
export function AdminRequestQueue() {
  const { locale, session, page } = useQueueState();
  const query = useSignupRequestsList(
    { status: 'raised', page, limit: 20 },
    {
      query: {
        queryKey: privateKey(session?.user.id ?? '', ['signup', locale, 'admin-queue', page]),
        enabled: !!session,
        retry: false,
      },
    },
  );
  return (
    <ApplicationQueueView
      admin
      page={page}
      data={query.data}
      pending={query.isPending}
      failed={query.isError}
      retry={() => void query.refetch()}
    />
  );
}
