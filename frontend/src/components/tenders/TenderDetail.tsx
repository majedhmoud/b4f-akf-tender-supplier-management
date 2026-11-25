'use client';
import { TenderBidAction } from '@/components/bids/TenderBidAction';

import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getPublicTendersFindOneQueryKey,
  usePublicTendersFindOne,
} from '@/lib/api/generated/public-tenders/public-tenders';
import { ApiError } from '@/lib/api/mutator';
import { publicKey } from '@/lib/api/query-keys';
import { directionOf, languageName } from '@/lib/format';
import { useServerNow } from '@/lib/useServerNow';
import { TenderDocuments } from './TenderDocuments';
import { BackLink } from '@/components/ui/back-link';

import { TenderDeadlines } from './TenderDeadlines';

export function TenderDetail({ tenderId }: { tenderId: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const now = useServerNow();
  const tender = usePublicTendersFindOne(tenderId, {
    query: {
      queryKey: publicKey(locale, getPublicTendersFindOneQueryKey(tenderId)),
      // A 404 means the tender is not public; asking again will not change that.
      retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
    },
  });

  const back = <BackLink href="/tenders">{t('Tender.back')}</BackLink>;

  if (tender.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (tender.isError) {
    const notPublic = tender.error instanceof ApiError && tender.error.status === 404;
    return (
      <div className="flex flex-col gap-4">
        {back}
        {notPublic ? (
          <EmptyState title={t('Tender.notFound')} hint={t('Tender.notFoundHint')} />
        ) : (
          <ErrorState
            title={t('Errors.genericTitle')}
            action={
              <Button variant="outline" size="sm" onClick={() => tender.refetch()}>
                {t('Common.retry')}
              </Button>
            }
          />
        )}
      </div>
    );
  }

  const data = tender.data;
  const contentLanguage = data.content.language;

  return (
    <article className="flex flex-col gap-5">
      {back}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1
            className="break-words text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            lang={contentLanguage}
            dir={directionOf(contentLanguage)}
          >
            {data.content.title}
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {t(`Categories.${data.categoryCode}`)}
          </p>
        </div>
        <Badge variant="secondary" className="mt-1">
          {t(`Statuses.${data.status}`)}
        </Badge>
      </header>
      {data.isFallback && (
        <Alert className="border-advisory-border bg-advisory">
          <AlertDescription className="text-advisory-foreground">
            {t('Tenders.fallback', { language: languageName(locale, contentLanguage) })}
          </AlertDescription>
        </Alert>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid min-w-0 gap-4">
          <section className="min-w-0 panel p-5 sm:p-6" aria-labelledby="tender-description">
            <h2 id="tender-description" className="mb-3 text-base font-bold">
              {t('Tender.description')}
            </h2>
            {/* Tender content keeps its own language and direction (API_CONTRACT.md §1.7). */}
            <p
              className="break-words text-sm leading-7 whitespace-pre-line text-muted-foreground"
              lang={contentLanguage}
              dir={directionOf(contentLanguage)}
            >
              {data.content.description}
            </p>
          </section>
          <section className="panel p-5" aria-labelledby="tender-documents">
            <h2 id="tender-documents" className="mb-4 text-base font-bold">
              {t('Tender.documents')}
            </h2>
            <TenderDocuments tenderId={data.id} documents={data.documents} />
          </section>
        </div>
        <aside className="grid min-w-0 gap-4">
          <TenderDeadlines deadlines={data.deadlines} now={now} />
          <TenderBidAction tenderId={data.id} />
        </aside>
      </div>
    </article>
  );
}

// The detail page's entry point: reads the tender id from the route.
export function TenderDetailFromRoute() {
  const { tenderId } = useParams<{ tenderId: string }>();
  return <TenderDetail tenderId={tenderId} />;
}
