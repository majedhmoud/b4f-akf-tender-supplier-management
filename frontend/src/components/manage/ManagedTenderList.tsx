'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useRouter } from '@/i18n/navigation';
import { useManageTendersList } from '@/lib/api/generated/tender-management/tender-management';
import { TenderStatus } from '@/lib/api/generated/model';
import { privateKey } from '@/lib/api/query-keys';
import { directionOf, formatDateTime } from '@/lib/format';
import { useSession } from '@/lib/useSession';
import { managementControl, ManagementField } from './ManagementFeedback';
import { listCardActionClass, listCardClass } from '@/components/ui/list-card';

export function ManagedTenderList() {
  const t = useTranslations();
  const locale = useLocale();
  const search = useSearchParams();
  const router = useRouter();
  const { session } = useSession();
  const rawStatus = search.get('status');
  const status = Object.values(TenderStatus).find((value) => value === rawStatus);
  const rawPage = Number(search.get('page'));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const query = useManageTendersList(
    { page, limit: 20, ...(status ? { status } : {}) },
    {
      query: {
        queryKey: privateKey(session?.user.id ?? '', [
          'manage-tenders',
          locale,
          'list',
          status ?? '',
          page,
        ]),
        enabled: !!session,
        retry: false,
      },
    },
  );
  function navigate(nextPage: number, nextStatus = status ?? '') {
    router.replace({
      pathname: '/manage/tenders',
      query: { page: nextPage, ...(nextStatus ? { status: nextStatus } : {}) },
    });
  }
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t('Manage.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('Manage.intro')}</p>
      </header>
      <div className="max-w-xs">
        <ManagementField label={t('Employee.status')}>
          <select
            className={managementControl}
            value={status ?? ''}
            onChange={(event) => navigate(1, event.target.value)}
          >
            <option value="">{t('Manage.allStatuses')}</option>
            {Object.values(TenderStatus).map((value) => (
              <option key={value} value={value}>
                {t(`Statuses.${value}`)}
              </option>
            ))}
          </select>
        </ManagementField>
      </div>
      {query.isPending && <Skeleton className="h-60" />}
      {query.isError && (
        <ErrorState
          title={t('Employee.loadFailed')}
          action={<Button onClick={() => void query.refetch()}>{t('Common.retry')}</Button>}
        />
      )}
      {query.data &&
        (query.data.data.length ? (
          <>
            <ul className="space-y-3 lg:hidden">
              {query.data.data.map((row) => (
                <li key={row.id} className={listCardClass}>
                  <Link
                    href={`/manage/tenders/${row.id}`}
                    lang={row.content.language}
                    dir={directionOf(row.content.language)}
                    className="block font-semibold text-primary hover:underline"
                  >
                    {row.content.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {t(`Categories.${row.categoryCode}`)} ·{' '}
                    <span dir="auto">{row.requestedBy.name}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{t(`Statuses.${row.status}`)}</Badge>
                    <time dateTime={row.createdAt}>{formatDateTime(locale, row.createdAt)}</time>
                  </div>
                  <Link href={`/manage/tenders/${row.id}`} className={listCardActionClass}>
                    {t('Employee.view')}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto panel lg:block">
              <table className="w-full text-start text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    {[
                      'Employee.tenderTitle',
                      'Manage.employee',
                      'Employee.createdAt',
                      'Employee.status',
                    ].map((key) => (
                      <th key={key} scope="col" className="px-5 py-3 text-start">
                        {t(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {query.data.data.map((row) => (
                    <tr key={row.id}>
                      <td className="min-w-48 px-5 py-5">
                        <Link
                          href={`/manage/tenders/${row.id}`}
                          lang={row.content.language}
                          dir={directionOf(row.content.language)}
                          className="block font-semibold text-primary hover:underline"
                        >
                          {row.content.title}
                        </Link>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t(`Categories.${row.categoryCode}`)}
                        </p>
                      </td>
                      <td className="px-5 py-5" dir="auto">
                        {row.requestedBy.name}
                      </td>
                      <td className="px-5 py-5">
                        <time dateTime={row.createdAt}>
                          {formatDateTime(locale, row.createdAt)}
                        </time>
                      </td>
                      <td className="px-5 py-5">
                        <Badge variant="secondary">{t(`Statuses.${row.status}`)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState title={t('Manage.empty')} />
        ))}
      {query.data && query.data.meta.totalPages > 1 && (
        <nav aria-label={t('Common.pagination')} className="flex flex-wrap justify-center gap-3">
          <Button variant="outline" disabled={page <= 1} onClick={() => navigate(page - 1)}>
            {t('Common.previous')}
          </Button>
          <span>{t('Common.pageOf', { page, totalPages: query.data.meta.totalPages })}</span>
          <Button
            variant="outline"
            disabled={page >= query.data.meta.totalPages}
            onClick={() => navigate(page + 1)}
          >
            {t('Common.next')}
          </Button>
        </nav>
      )}
    </section>
  );
}
