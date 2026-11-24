'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useRouter } from '@/i18n/navigation';
import type { ManagedTender } from '@/lib/api/generated/model';
import {
  useManageTendersFindOne,
  useManageTendersCopy,
} from '@/lib/api/generated/tender-management/tender-management';
import { ApiError } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { directionOf, formatDateTime } from '@/lib/format';
import { useSession } from '@/lib/useSession';
import { ManagedDocuments } from './ManagedDocuments';
import { TenderCommittees } from '@/components/committees/TenderCommittees';
import { ManagedTenderForm, PublishTenderForm } from './ManagedTenderForm';
import { ManagementFeedback, useManagementAction } from './ManagementFeedback';

function TenderPanels({
  tender,
  done,
  reload,
}: {
  tender: ManagedTender;
  done: () => Promise<void>;
  reload: () => Promise<void>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [panel, setPanel] = useState('overview');
  const [confirmCopy, setConfirmCopy] = useState(false);
  const action = useManagementAction();
  const copy = useManageTendersCopy({ mutation: { retry: false } });
  const canAccept = tender.status === 'draft' && tender.allowedActions.includes('accept');
  const canEdit = tender.status === 'accepted' && tender.allowedActions.includes('edit');
  const canPublish = tender.status === 'accepted' && tender.allowedActions.includes('publish');
  const canCopy =
    tender.status === 'cancelled' &&
    tender.allowedActions.includes('copy') &&
    !tender.copiedIntoTenderId;
  const title =
    tender.translations.find((row) => row.language === locale) ?? tender.translations[0];
  const panels = [
    'overview',
    ...(canAccept || canEdit ? ['edit'] : []),
    'documents',
    ...(canPublish ? ['publish'] : []),
  ];
  return (
    <article className="space-y-5">
      <Link href="/manage/tenders" className="text-sm text-primary hover:underline">
        {t('Manage.back')}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1
            className="break-words text-2xl font-bold"
            lang={title.language}
            dir={directionOf(title.language)}
          >
            {title.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('Manage.employee')}: <bdi>{tender.requestedBy.name}</bdi>
          </p>
        </div>
        <Badge variant="secondary">{t(`Statuses.${tender.status}`)}</Badge>
      </header>
      <ManagementFeedback error={action.error} reload={reload} />
      {tender.status !== 'draft' && (
        <Link
          href={`/manage/tenders/${tender.id}/bid-form`}
          className={buttonVariants({ variant: 'outline' })}
        >
          {t('Manage.bidForm')}
        </Link>
      )}
      {canCopy && (
        <div className="space-y-3 panel p-4">
          <p className="text-sm">{t('Manage.copyHint')}</p>
          {!confirmCopy ? (
            <Button variant="outline" onClick={() => setConfirmCopy(true)}>
              {t('Manage.copy')}
            </Button>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={action.busy || action.locked}
                onClick={() =>
                  void action.run(async () => {
                    const result = await copy.mutateAsync({ tenderId: tender.id });
                    router.push(`/manage/tenders/${result.id}`);
                  }, done)
                }
              >
                {t('Manage.confirmCopy')}
              </Button>
              <Button
                variant="outline"
                disabled={action.busy}
                onClick={() => setConfirmCopy(false)}
              >
                {t('Manage.cancel')}
              </Button>
            </div>
          )}
        </div>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label={t('Employee.sections')} className="flex flex-col gap-2 panel p-4">
          {panels.map((item) => (
            <Button
              key={item}
              variant={panel === item ? 'secondary' : 'ghost'}
              aria-current={panel === item ? 'page' : undefined}
              className="justify-start"
              onClick={() => setPanel(item)}
            >
              {t(`Manage.panel_${item}`)}
            </Button>
          ))}
        </nav>
        <div className="min-w-0">
          {panel === 'overview' && (
            <section className="space-y-5 panel p-5">
              <h2 className="text-lg font-bold">{t('Manage.panel_overview')}</h2>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{t('Employee.category')}</dt>
                  <dd>{t(`Categories.${tender.categoryCode}`)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('Employee.amount')}</dt>
                  <dd>
                    <bdi>
                      {tender.estimatedBalance.amount} {tender.estimatedBalance.currency}
                    </bdi>
                  </dd>
                </div>
                {tender.scoring &&
                  (['technicalWeight', 'financialWeight', 'minimumTechnicalScore'] as const).map(
                    (key) => (
                      <div key={key}>
                        <dt className="text-muted-foreground">{t(`Manage.${key}`)}</dt>
                        <dd>{tender.scoring?.[key]}</dd>
                      </div>
                    ),
                  )}
                {tender.deadlines &&
                  (['application', 'technical', 'financial'] as const).map((key) => (
                    <div key={key}>
                      <dt className="text-muted-foreground">{t(`Manage.deadline_${key}`)}</dt>
                      <dd>
                        <time dateTime={tender.deadlines?.[key]}>
                          {formatDateTime(locale, tender.deadlines![key])}
                        </time>
                      </dd>
                    </div>
                  ))}
              </dl>
              {tender.translations.map((row) => (
                <section
                  key={row.language}
                  lang={row.language}
                  dir={directionOf(row.language)}
                  className="space-y-2"
                >
                  <h3 className="font-semibold">{row.title}</h3>
                  <p className="break-words text-sm leading-7 whitespace-pre-line">
                    {row.description}
                  </p>
                </section>
              ))}
              {tender.cancellationReason && (
                <p className="text-sm">{t(`Manage.reason_${tender.cancellationReason}`)}</p>
              )}
              {tender.copiedFromTenderId && (
                <Link
                  href={`/manage/tenders/${tender.copiedFromTenderId}`}
                  className="block text-sm text-primary hover:underline"
                >
                  {t('Manage.sourceTender')}
                </Link>
              )}
              {tender.copiedIntoTenderId && (
                <Link
                  href={`/manage/tenders/${tender.copiedIntoTenderId}`}
                  className="block text-sm text-primary hover:underline"
                >
                  {t('Manage.copiedTender')}
                </Link>
              )}
              {!canAccept && !canEdit && (
                <p className="text-sm text-muted-foreground">{t('Manage.readOnly')}</p>
              )}
            </section>
          )}
          {panel === 'edit' && (canAccept || canEdit) && (
            <ManagedTenderForm tender={tender} done={done} reload={reload} />
          )}
          {panel === 'documents' && (
            <ManagedDocuments tender={tender} done={done} reload={reload} />
          )}
          {panel === 'publish' && canPublish && (
            <PublishTenderForm tender={tender} done={done} reload={reload} />
          )}
        </div>
      </div>
      <TenderCommittees tenderId={tender.id} status={tender.status} />
    </article>
  );
}
export function ManagedTenderDetail({ tenderId }: { tenderId: string }) {
  const t = useTranslations('Manage');
  const { session } = useSession();
  const locale = useLocale();
  const client = useQueryClient();
  const [version, setVersion] = useState(0);
  const [saved, setSaved] = useState(false);
  const query = useManageTendersFindOne(tenderId, {
    query: {
      queryKey: privateKey(session?.user.id ?? '', ['manage-tenders', locale, 'detail', tenderId]),
      enabled: !!session,
      retry: false,
    },
  });
  async function reload() {
    setSaved(false);
    const result = await query.refetch();
    if (result.data && !result.error) setVersion((value) => value + 1);
  }
  async function done() {
    await client.invalidateQueries({
      queryKey: privateKey(session?.user.id ?? '', ['manage-tenders']),
      refetchType: 'none',
    });
    await reload();
    setSaved(true);
  }
  if (query.isPending) return <Skeleton className="h-64" />;
  if (query.isError)
    return query.error instanceof ApiError && query.error.status === 404 ? (
      <EmptyState title={t('notFound')} />
    ) : (
      <ErrorState
        title={t('loadFailed')}
        action={<Button onClick={() => void query.refetch()}>{t('retry')}</Button>}
      />
    );
  return (
    <div className="space-y-4">
      {saved && (
        <p role="status" className="rounded-md bg-secondary p-3 text-sm">
          {t('saved')}
        </p>
      )}
      <TenderPanels
        key={`${tenderId}-${version}`}
        tender={query.data}
        done={done}
        reload={reload}
      />
    </div>
  );
}
export function ManagedTenderFromRoute() {
  const { tenderId } = useParams<{ tenderId: string }>();
  return <ManagedTenderDetail key={tenderId} tenderId={tenderId} />;
}
