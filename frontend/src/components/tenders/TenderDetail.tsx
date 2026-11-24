'use client';
import { TenderBidAction } from '@/components/bids/TenderBidAction';

import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import {
  getPublicTendersFindOneQueryKey,
  usePublicTendersFindOne,
} from '@/lib/api/generated/public-tenders/public-tenders';
import { ApiError } from '@/lib/api/mutator';
import { publicKey } from '@/lib/api/query-keys';
import { directionOf, formatDateTime, formatRelative, isPast, languageName } from '@/lib/format';
import { useServerNow } from '@/lib/useServerNow';
import { TenderDocuments } from './TenderDocuments';

const DEADLINES = ['application', 'technical', 'financial'] as const;

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

  const back = (
    <Link
      href="/tenders"
      className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      {t('Tender.back')}
    </Link>
  );

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
        <Badge variant="secondary" className="mt-1 px-3 font-semibold">
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
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
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
        <aside className="flex min-w-0 flex-col gap-4">
          <section className="panel p-5" aria-labelledby="tender-documents">
            <h2 id="tender-documents" className="mb-4 text-base font-bold">
              {t('Tender.documents')}
            </h2>
            <TenderDocuments tenderId={data.id} documents={data.documents} />
          </section>
          <TenderBidAction tenderId={data.id} />
          <Card size="sm" className="rounded-md border py-5 ring-0">
            <CardHeader className="px-5">
              <CardTitle className="font-bold">{t('Tender.deadlines')}</CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              <dl className="flex flex-col divide-y text-sm">
                {DEADLINES.map((key) => {
                  const at = data.deadlines[key];
                  const passed = now !== null && isPast(at, now);
                  return (
                    <div
                      key={key}
                      className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
                    >
                      <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-advisory-border"
                          aria-hidden="true"
                        />
                        {t(`Tender.${key}`)}
                      </dt>
                      <dd className="ms-auto text-end">
                        <time dateTime={at} className="block text-xs font-semibold">
                          {formatDateTime(locale, at)}
                        </time>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {passed
                            ? t('Tender.passed')
                            : t('Tender.closesIn', {
                                when: now === null ? '…' : formatRelative(locale, at, now),
                              })}
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </CardContent>
          </Card>
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
