'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from '@/i18n/navigation';
import {
  useAdminNominationsApprove,
  useAdminNominationsList,
  useAdminNominationsReject,
} from '@/lib/api/generated/committees/committees';
import type { AdminNominationItem, Language } from '@/lib/api/generated/model';
import { ApiError } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { useSession } from '@/lib/useSession';

const PATH = '/admin/committee-nominations';

// C5–C6: the admin approves or rejects nominations (API_CONTRACT.md, Committees).
export function AdminNominationQueue() {
  const t = useTranslations('Committees');
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();
  const { session } = useSession();
  const raw = Number(search.get('page'));
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const base = privateKey(session?.user.id ?? '', ['admin-nominations']);
  const query = useAdminNominationsList(
    { status: 'nominated', page, limit: 20 },
    { query: { queryKey: [...base, locale, page], enabled: !!session, retry: false } },
  );

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{t('queueTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('queueHint')}</p>
      </header>
      {query.isPending && <Skeleton className="h-64" />}
      {query.isError && (
        <ErrorState
          title={t('loadFailed')}
          action={<Button onClick={() => void query.refetch()}>{t('retry')}</Button>}
        />
      )}
      {query.data &&
        (query.data.data.length ? (
          <ul className="space-y-3">
            {query.data.data.map((row) => (
              <NominationRow key={row.id} row={row} base={base} />
            ))}
          </ul>
        ) : (
          <EmptyState title={t('queueEmpty')} />
        ))}
      {query.data && query.data.meta.totalPages > 1 && (
        <nav
          aria-label={t('pagination')}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => router.replace({ pathname: PATH, query: { page: page - 1 } })}
          >
            {t('previous')}
          </Button>
          <span>{t('pageOf', { page, total: query.data.meta.totalPages })}</span>
          <Button
            variant="outline"
            disabled={page >= query.data.meta.totalPages}
            onClick={() => router.replace({ pathname: PATH, query: { page: page + 1 } })}
          >
            {t('next')}
          </Button>
        </nav>
      )}
    </section>
  );
}

function NominationRow({ row, base }: { row: AdminNominationItem; base: readonly unknown[] }) {
  const t = useTranslations('Committees');
  const client = useQueryClient();
  const approve = useAdminNominationsApprove<ApiError>();
  const reject = useAdminNominationsReject<ApiError>();
  const [language, setLanguage] = useState<Language>('en');
  const [result, setResult] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const busy = approve.isPending || reject.isPending;

  async function decide(action: 'approve' | 'reject') {
    setFailure(null);
    try {
      if (action === 'approve') {
        const decision = await approve.mutateAsync({
          nominationId: row.id,
          data: row.hasAccount ? {} : { preferredLanguage: language },
        });
        setResult(decision.accountCreated ? 'approvedWithEmail' : 'approved');
      } else {
        await reject.mutateAsync({ nominationId: row.id });
        setResult('rejected');
      }
      await client.invalidateQueries({ queryKey: base });
    } catch (e) {
      setFailure(e instanceof ApiError ? e.code : 'UNKNOWN_ERROR');
    }
  }

  return (
    <li className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-semibold" dir="auto">
            {row.nomineeName}{' '}
            <span className="font-normal text-muted-foreground" dir="ltr">
              {row.nomineeEmail}
            </span>
          </p>
          <p className="text-sm" dir="auto" lang={row.tenderContent.language}>
            {row.tenderContent.title}
          </p>
          <p className="text-sm text-muted-foreground">
            {t(`types.${row.committeeType}`)} · {t(row.hasAccount ? 'hasAccount' : 'noAccount')}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {!row.hasAccount && (
            <div className="space-y-1">
              <label htmlFor={`language-${row.id}`} className="block text-sm font-semibold">
                {t('accountLanguage')}
              </label>
              <select
                id={`language-${row.id}`}
                value={language}
                disabled={busy}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="field-control h-10 w-auto"
              >
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </div>
          )}
          <Button disabled={busy} onClick={() => void decide('approve')}>
            {t('approve')}
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void decide('reject')}>
            {t('reject')}
          </Button>
        </div>
      </div>
      {result && (
        <p role="status" className="text-sm font-semibold text-primary">
          {t(`results.${result}`)}
        </p>
      )}
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {t.has(`errors.${failure}`) ? t(`errors.${failure}`) : t('failed')}
        </p>
      )}
    </li>
  );
}
