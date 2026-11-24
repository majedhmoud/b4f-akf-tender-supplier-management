'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useParams, useSearchParams } from 'next/navigation';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useRouter } from '@/i18n/navigation';
import type { BlindQueuePage, LegalQueuePage } from '@/lib/api/generated/model';
import { ApiError, apiFetch } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { useSession } from '@/lib/useSession';
import { SignInRequired } from './SignInRequired';
import { isStage, STAGE_URLS } from './stages';
import { BackLink } from '@/components/ui/back-link';

// L1, X1, F1: the bids this assignment may evaluate.
export function EvaluationQueue() {
  const t = useTranslations('Evaluations');
  const router = useRouter();
  const search = useSearchParams();
  const { stage, tenderId } = useParams<{ stage: string; tenderId: string }>();
  const { session, isLoading } = useSession();
  const raw = Number(search.get('page'));
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const valid = isStage(stage);
  const query = useQuery({
    queryKey: privateKey(session?.user.id ?? '', ['evaluations', stage, tenderId, 'queue', page]),
    queryFn: () =>
      apiFetch<LegalQueuePage | BlindQueuePage>(
        STAGE_URLS[valid ? stage : 'legal'].queue(tenderId, { page, limit: 20 }),
      ),
    enabled: !!session && valid,
    retry: false,
  });
  if (isLoading) return <Skeleton className="h-64" />;
  if (!session) return <SignInRequired />;
  if (!valid) return <EmptyState title={t('notFound')} />;
  const base = `/evaluations/${stage}/tenders/${tenderId}`;
  return (
    <section className="space-y-5">
      <header>
        <BackLink href="/my-assignments">{t('backToAssignments')}</BackLink>
        <h1 className="mt-2 text-2xl font-bold">{t(`titles.${stage}`)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(`hints.${stage}`)}</p>
      </header>
      {query.isPending && <Skeleton className="h-64" />}
      {query.isError && <QueueError error={query.error} retry={() => void query.refetch()} />}
      {query.data &&
        (query.data.data.length ? (
          <ul className="space-y-3">
            {query.data.data.map((row) => {
              const ref = 'bidId' in row ? row.bidId : row.bidderCode;
              return (
                <li
                  key={ref}
                  className="panel flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <Link
                    href={`${base}/bids/${encodeURIComponent(ref)}`}
                    className="font-semibold text-primary underline underline-offset-4"
                    dir="auto"
                  >
                    {'bidId' in row
                      ? String(row.supplier.legalName)
                      : t('bidder', { code: row.bidderCode })}
                  </Link>
                  <Badge variant={row.evaluated ? 'secondary' : 'default'}>
                    {t(row.evaluated ? 'evaluated' : 'toEvaluate')}
                  </Badge>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title={t('empty')} />
        ))}
      {query.data && query.data.meta.totalPages > 1 && (
        <nav
          aria-label={t('pagination')}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => router.replace({ pathname: base, query: { page: page - 1 } })}
          >
            {t('previous')}
          </Button>
          <span>{t('pageOf', { page, total: query.data.meta.totalPages })}</span>
          <Button
            variant="outline"
            disabled={page >= query.data.meta.totalPages}
            onClick={() => router.replace({ pathname: base, query: { page: page + 1 } })}
          >
            {t('next')}
          </Button>
        </nav>
      )}
    </section>
  );
}

export function QueueError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations('Evaluations');
  if (error instanceof ApiError && error.status === 404)
    return <EmptyState title={t('notFound')} />;
  if (error instanceof ApiError && error.code === 'TENDER_STATUS_CHANGED')
    return <EmptyState title={t('notStarted')} />;
  return (
    <ErrorState title={t('loadFailed')} action={<Button onClick={retry}>{t('retry')}</Button>} />
  );
}
