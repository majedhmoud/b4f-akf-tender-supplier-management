'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useRouter } from '@/i18n/navigation';
import { STAGE_OF } from '@/components/evaluations/stages';
import { useMyAssignmentsList } from '@/lib/api/generated/committees/committees';
import { privateKey } from '@/lib/api/query-keys';
import { useSession } from '@/lib/useSession';

// C7: the signed-in user's approved committee assignments.
export function MyAssignments() {
  const t = useTranslations('Committees');
  const locale = useLocale();
  const router = useRouter();
  const { session, isLoading, error, retry } = useSession();
  useEffect(() => {
    if (!isLoading && !error && !session)
      router.replace({ pathname: '/sign-in', query: { returnTo: '/my-assignments' } }, { locale });
  }, [session, isLoading, error, router, locale]);
  const query = useMyAssignmentsList(
    { page: 1, limit: 100 },
    {
      query: {
        queryKey: privateKey(session?.user.id ?? '', ['assignments', locale]),
        enabled: !!session,
        retry: false,
      },
    },
  );
  if (error)
    return (
      <ErrorState title={t('loadFailed')} action={<Button onClick={retry}>{t('retry')}</Button>} />
    );
  if (isLoading || !session || query.isPending) return <Skeleton className="h-40" />;
  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{t('assignmentsTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('assignmentsHint')}</p>
      </header>
      {query.isError && (
        <ErrorState
          title={t('loadFailed')}
          action={<Button onClick={() => void query.refetch()}>{t('retry')}</Button>}
        />
      )}
      {query.data &&
        (query.data.data.length ? (
          <ul className="space-y-3">
            {query.data.data.map((a) => (
              <li
                key={a.assignmentId}
                className="panel flex flex-wrap items-center justify-between gap-4 p-5"
              >
                <div className="min-w-0 space-y-1">
                  <Link
                    href={`/evaluations/${STAGE_OF[a.committeeType]}/tenders/${a.tenderId}`}
                    className="font-semibold text-primary underline underline-offset-4"
                    dir="auto"
                    lang={a.tenderContent.language}
                  >
                    {a.tenderContent.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">{t(`types.${a.committeeType}`)}</p>
                </div>
                <Badge variant={a.stage === 'open' ? 'default' : 'secondary'}>
                  {a.stage === 'open'
                    ? t('pendingCount', { count: a.pendingCount })
                    : t(`stages.${a.stage}`)}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t('assignmentsEmpty')} />
        ))}
    </section>
  );
}
