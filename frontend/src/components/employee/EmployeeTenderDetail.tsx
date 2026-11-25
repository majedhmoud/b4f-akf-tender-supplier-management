'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { TenderDeadlines } from '@/components/tenders/TenderDeadlines';
import { useState } from 'react';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Link } from '@/i18n/navigation';
import {
  useEmployeeTendersDownload,
  useEmployeeTendersFindOne,
} from '@/lib/api/generated/employee-tenders/employee-tenders';
import type { TenderDocumentView } from '@/lib/api/generated/model';
import { ApiError, apiUrl } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { directionOf, languageName } from '@/lib/format';
import { useSession } from '@/lib/useSession';
import { DraftTenderForm } from './DraftTenderForm';
import { BackLink } from '@/components/ui/back-link';

function EmployeeDocument({
  tenderId,
  document,
}: {
  tenderId: string;
  document: Pick<TenderDocumentView, 'id' | 'name' | 'language'>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { session } = useSession();
  const [failed, setFailed] = useState(false);
  const client = useQueryClient();
  const download = useEmployeeTendersDownload(tenderId, document.id, {
    query: {
      queryKey: privateKey(session?.user.id ?? '', [
        'employee-tenders',
        locale,
        'download',
        tenderId,
        document.id,
      ]),
      enabled: false,
      retry: false,
      gcTime: 0,
    },
  });
  async function open() {
    setFailed(false);
    try {
      const result = await download.refetch();
      if (result.error || !result.data) {
        setFailed(true);
        return;
      }
      window.location.assign(apiUrl(result.data.url));
    } catch {
      setFailed(true);
    } finally {
      // Signed URLs are transient, even in private caches (API_CONTRACT.md §1.2).
      client.removeQueries({
        queryKey: privateKey(session?.user.id ?? '', [
          'employee-tenders',
          locale,
          'download',
          tenderId,
          document.id,
        ]),
        exact: true,
      });
    }
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium" dir="auto">
          {document.name}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {languageName(locale, document.language)}
        </p>
      </div>
      <Button variant="outline" disabled={download.isFetching} onClick={() => void open()}>
        {t('Tender.download')}
      </Button>
      {failed && (
        <p role="alert" className="w-full text-sm text-destructive">
          {t('Tender.downloadFailed')}
        </p>
      )}
    </li>
  );
}

export function EmployeeTenderDetail({
  tenderId,
  edit = false,
}: {
  tenderId: string;
  edit?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { session } = useSession();
  const [reloadCount, setReloadCount] = useState(0);
  const tender = useEmployeeTendersFindOne(tenderId, {
    query: {
      queryKey: privateKey(session?.user.id ?? '', [
        'employee-tenders',
        locale,
        'detail',
        tenderId,
      ]),
      enabled: !!session,
      retry: false,
    },
  });
  if (tender.isPending) return <Skeleton className="h-64" />;
  if (tender.isError)
    return tender.error instanceof ApiError && tender.error.status === 404 ? (
      <EmptyState title={t('Employee.notFound')} />
    ) : (
      <ErrorState
        title={t('Employee.loadFailed')}
        action={<Button onClick={() => void tender.refetch()}>{t('Common.retry')}</Button>}
      />
    );

  const data = tender.data;
  const editable = data.status === 'draft' && data.allowedActions.includes('edit');
  if (edit && editable)
    return (
      <DraftTenderForm
        key={data.id + '-' + reloadCount}
        initial={data}
        onReload={async () => {
          const result = await tender.refetch();
          if (result.data && !result.error) setReloadCount((count) => count + 1);
        }}
      />
    );
  const content = data.translations.find((row) => row.language === locale) ?? data.translations[0];
  const documents = data.documents.flatMap((document) => [document, ...document.translations]);
  return (
    <article className="flex flex-col gap-5">
      <BackLink href="/employee/tenders">{t('Employee.back')}</BackLink>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1
            lang={content.language}
            dir={directionOf(content.language)}
            className="break-words text-2xl font-bold"
          >
            {content.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(`Categories.${data.categoryCode}`)}
          </p>
        </div>
        <Badge
          variant="secondary"
          className={data.status === 'draft' ? 'bg-advisory text-advisory-foreground' : undefined}
        >
          {t(`Statuses.${data.status}`)}
        </Badge>
        {editable && (
          <Link href={`/employee/tenders/${data.id}/edit`} className={buttonVariants()}>
            {t('Employee.edit')}
          </Link>
        )}
      </header>
      {edit && !editable && (
        <p role="status" className="rounded-md border bg-advisory p-4 text-sm">
          {t('Employee.statusChanged')}
        </p>
      )}
      {data.status === 'draft' && (
        <p className="rounded-md bg-secondary p-4 text-sm text-primary">
          {t('Employee.draftOnly')}
        </p>
      )}
      <Tabs dir={locale === 'ar' ? 'rtl' : 'ltr'} defaultValue="basics">
        <TabsList aria-label={t('Employee.sections')}>
          <TabsTrigger value="basics">{t('Employee.basics')}</TabsTrigger>
          <TabsTrigger value="translations">{t('Employee.translations')}</TabsTrigger>
        </TabsList>
        <TabsContent value="basics">
          <h2 className="mb-4 font-bold">{t('Employee.basics')}</h2>
          <dl className="grid gap-5 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{t('Employee.category')}</dt>
              <dd className="mt-2">{t(`Categories.${data.categoryCode}`)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t('Employee.amount')}</dt>
              <dd className="mt-2">
                <bdi>{data.estimatedBalance.amount}</bdi>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t('Employee.currency')}</dt>
              <dd className="mt-2">
                <bdi>{data.estimatedBalance.currency}</bdi>
              </dd>
            </div>
          </dl>
        </TabsContent>
        <TabsContent value="translations">
          <h2 className="mb-4 font-bold">{t('Employee.translations')}</h2>
          <div className="flex flex-col gap-5">
            {data.translations.map((row) => (
              <section key={row.language} lang={row.language} dir={directionOf(row.language)}>
                <h3 className="mb-2 text-sm font-semibold">{row.title}</h3>
                <p className="break-words text-sm leading-7 whitespace-pre-line text-muted-foreground">
                  {row.description}
                </p>
              </section>
            ))}
          </div>
          <section className="mt-6 border-t pt-5">
            <h2 className="font-bold">{t('Tender.documents')}</h2>
            {documents.length ? (
              <ul className="mt-3 divide-y">
                {documents.map((document) => (
                  <EmployeeDocument key={document.id} tenderId={data.id} document={document} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t('Tender.noDocuments')}</p>
            )}
          </section>
        </TabsContent>
      </Tabs>
      {data.deadlines && <TenderDeadlines deadlines={data.deadlines} />}
    </article>
  );
}

export function EmployeeTenderFromRoute({ edit = false }: { edit?: boolean }) {
  const { tenderId } = useParams<{ tenderId: string }>();
  return <EmployeeTenderDetail key={tenderId} tenderId={tenderId} edit={edit} />;
}
