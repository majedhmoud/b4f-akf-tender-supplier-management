'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useRouter } from '@/i18n/navigation';
import { useEmployeeTendersList } from '@/lib/api/generated/employee-tenders/employee-tenders';
import { privateKey } from '@/lib/api/query-keys';
import { directionOf, formatDateTime, languageName } from '@/lib/format';
import { useSession } from '@/lib/useSession';
import { listCardActionClass, listCardClass } from '@/components/ui/list-card';

export function EmployeeTenderList() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();
  const { session } = useSession();
  const requestedPage = Number(search.get('page'));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const tenders = useEmployeeTendersList(
    { page, limit: 20 },
    {
      query: {
        queryKey: privateKey(session?.user.id ?? '', ['employee-tenders', locale, 'list', page]),
        enabled: !!session,
        retry: false,
      },
    },
  );
  const meta = tenders.data?.meta;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('Employee.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('Employee.intro')}</p>
        </div>
        <Link href="/employee/tenders/new" className={buttonVariants({ size: 'lg' })}>
          {t('Employee.create')}
        </Link>
      </header>
      {tenders.isPending && <Skeleton className="h-60" />}
      {tenders.isError && (
        <ErrorState
          title={t('Employee.loadFailed')}
          action={<Button onClick={() => void tenders.refetch()}>{t('Common.retry')}</Button>}
        />
      )}
      {tenders.data &&
        (tenders.data.data.length ? (
          <>
            <ul className="space-y-3 lg:hidden">
              {tenders.data.data.map((tender) => (
                <li key={tender.id} className={listCardClass}>
                  <Link
                    href={`/employee/tenders/${tender.id}`}
                    lang={tender.content.language}
                    dir={directionOf(tender.content.language)}
                    className="block font-semibold hover:text-primary hover:underline"
                  >
                    {tender.content.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {t(`Categories.${tender.categoryCode}`)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant="secondary"
                      className={
                        tender.status === 'draft'
                          ? 'bg-advisory text-advisory-foreground'
                          : undefined
                      }
                    >
                      {t(`Statuses.${tender.status}`)}
                    </Badge>
                    <time dateTime={tender.createdAt}>
                      {formatDateTime(locale, tender.createdAt)}
                    </time>
                  </div>
                  <Link href={`/employee/tenders/${tender.id}`} className={listCardActionClass}>
                    {t('Employee.view')}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto panel lg:block">
              <table className="w-full text-start text-sm">
                <thead className="bg-secondary/50 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-start">
                      {t('Employee.tenderTitle')}
                    </th>
                    <th scope="col" className="px-5 py-3 text-start">
                      {t('Employee.createdAt')}
                    </th>
                    <th scope="col" className="px-5 py-3 text-start">
                      {t('Employee.status')}
                    </th>
                    <th scope="col" className="px-5 py-3 text-end">
                      {t('Employee.action')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tenders.data.data.map((tender) => (
                    <tr key={tender.id}>
                      <td className="min-w-48 px-5 py-5">
                        <Link
                          href={`/employee/tenders/${tender.id}`}
                          lang={tender.content.language}
                          dir={directionOf(tender.content.language)}
                          className="block font-semibold hover:text-primary hover:underline"
                        >
                          {tender.content.title}
                        </Link>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t(`Categories.${tender.categoryCode}`)}
                        </p>
                        {tender.isFallback && (
                          <p className="mt-1 text-xs text-advisory-foreground">
                            {t('Tenders.fallbackShort', {
                              language: languageName(locale, tender.content.language),
                            })}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-5 text-xs text-muted-foreground">
                        <time dateTime={tender.createdAt}>
                          {formatDateTime(locale, tender.createdAt)}
                        </time>
                      </td>
                      <td className="px-5 py-5">
                        <Badge
                          variant="secondary"
                          className={
                            tender.status === 'draft'
                              ? 'bg-advisory text-advisory-foreground'
                              : undefined
                          }
                        >
                          {t(`Statuses.${tender.status}`)}
                        </Badge>
                      </td>
                      <td className="px-5 py-5 text-end">
                        <Link
                          href={`/employee/tenders/${tender.id}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {t('Employee.view')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState title={t('Employee.empty')} />
        ))}
      {meta && meta.totalPages > 1 && (
        <nav
          aria-label={t('Common.pagination')}
          className="flex flex-wrap items-center justify-center gap-3 text-sm"
        >
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() =>
              router.replace({ pathname: '/employee/tenders', query: { page: page - 1 } })
            }
          >
            {t('Common.previous')}
          </Button>
          <span>{t('Common.pageOf', { page, totalPages: meta.totalPages })}</span>
          <Button
            variant="outline"
            disabled={page >= meta.totalPages}
            onClick={() =>
              router.replace({ pathname: '/employee/tenders', query: { page: page + 1 } })
            }
          >
            {t('Common.next')}
          </Button>
        </nav>
      )}
    </section>
  );
}
