'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useRouter } from '@/i18n/navigation';
import { useMyBidsList } from '@/lib/api/generated/bids/bids';
import { privateKey } from '@/lib/api/query-keys';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/lib/useSession';

// B3: the supplier's own bids, with the tender status only.
export function MyBids() {
  const t = useTranslations('Bids');
  const locale = useLocale();
  const { session } = useSession();
  const router = useRouter();
  const search = useSearchParams();
  const raw = Number(search.get('page'));
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  function go(next: number) {
    router.replace({
      pathname: '/my-bids',
      query: { ...Object.fromEntries(search.entries()), page: next },
    });
  }
  const query = useMyBidsList(
    { page, limit: 20 },
    {
      query: {
        queryKey: privateKey(session?.user.id ?? '', ['bids', locale, 'list', page]),
        enabled: !!session,
        retry: false,
      },
    },
  );
  if (query.isPending) return <Skeleton className="h-40" />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        title={t('loadFailed')}
        action={<Button onClick={() => void query.refetch()}>{t('retry')}</Button>}
      />
    );
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold">{t('myBids')}</h1>
      {query.data.data.length ? (
        <ul className="space-y-3">
          {query.data.data.map((bid) => (
            <li
              key={bid.bidId}
              className="panel flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0 space-y-1">
                <Link
                  href={`/my-bids/${bid.bidId}`}
                  className="font-semibold text-primary underline underline-offset-4"
                  dir="auto"
                  lang={bid.tender.content.language}
                >
                  {bid.tender.content.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {bid.nextDeadline
                    ? t('nextDeadline', { when: formatDateTime(locale, bid.nextDeadline) })
                    : t('allLocked')}
                </p>
              </div>
              <Badge variant="secondary">{t(`tenderStatus.${bid.tender.status}`)}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t('noBids')} />
      )}
      {query.data.meta.totalPages > 1 && (
        <nav
          aria-label={t('pagination')}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Button variant="outline" disabled={page <= 1} onClick={() => go(page - 1)}>
            {t('previous')}
          </Button>
          <span>{t('pageOf', { page, total: query.data.meta.totalPages })}</span>
          <Button
            variant="outline"
            disabled={page >= query.data.meta.totalPages}
            onClick={() => go(page + 1)}
          >
            {t('next')}
          </Button>
        </nav>
      )}
    </section>
  );
}
