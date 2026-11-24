'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getAwardsAwardUrl,
  useAwardsRanking,
  useAwardsStatus,
} from '@/lib/api/generated/award/award';
import type { TenderStatus, TieBreakResult } from '@/lib/api/generated/model';
import { ApiError, apiFetch } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { formatDateTime } from '@/lib/format';
import { useReturnFocus } from '@/lib/useReturnFocus';
import { useSession } from '@/lib/useSession';

// Award state appears once bidding has closed.
const SHOWN: TenderStatus[] = ['closed', 'under_evaluation', 'awarded', 'cancelled'];

// W1–W3 on the managed tender page (API_CONTRACT.md, Award): progress, the
// ranking with names and scores but no bid contents, and the tie break.
export function TenderAward({ tenderId, status }: { tenderId: string; status: TenderStatus }) {
  const t = useTranslations('Award');
  const locale = useLocale();
  const { session } = useSession();
  const client = useQueryClient();
  const base = privateKey(session?.user.id ?? '', ['award', tenderId]);
  const enabled = !!session && SHOWN.includes(status);
  const state = useAwardsStatus(tenderId, {
    query: { queryKey: [...base, 'status'], enabled, retry: false },
  });
  const ranking = useAwardsRanking(
    tenderId,
    { page: 1, limit: 100 },
    { query: { queryKey: [...base, 'ranking'], enabled, retry: false } },
  );
  const [choosing, setChoosing] = useState<string | null>(null);
  const { register, returnTo } = useReturnFocus();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useRef<string | null>(null);

  if (!SHOWN.includes(status)) return null;

  async function choose(bidId: string) {
    setFailure(null);
    key.current ??= crypto.randomUUID();
    setBusy(true);
    try {
      await apiFetch<TieBreakResult>(getAwardsAwardUrl(tenderId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key.current },
        body: JSON.stringify({ bidId }),
      });
      key.current = null;
      setChoosing(null);
      // The award prepares the emails and changes the tender status.
      await client.invalidateQueries({ queryKey: privateKey(session?.user.id ?? '', []) });
    } catch (error) {
      setFailure(error instanceof ApiError ? error.code : 'UNKNOWN_ERROR');
      if (error instanceof ApiError) key.current = null;
    } finally {
      setBusy(false);
    }
  }

  const data = state.data;
  const candidates = new Set(data?.tieBreakCandidates.map((c) => c.bidId) ?? []);
  return (
    <section className="panel mt-6 space-y-4 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        {data && <Badge variant="secondary">{t(`statuses.${data.awardStatus}`)}</Badge>}
      </header>
      {state.isPending && <Skeleton className="h-32" />}
      {state.isError && (
        <ErrorState
          title={t('loadFailed')}
          action={<Button onClick={() => void state.refetch()}>{t('retry')}</Button>}
        />
      )}
      {data && (
        <>
          <dl className="grid gap-3 sm:grid-cols-3">
            {(['legal', 'technical', 'financial'] as const).map((stage) => (
              <div key={stage} className="rounded-md border border-border p-3">
                <dt className="text-sm text-muted-foreground">{t(`stages.${stage}`)}</dt>
                <dd className="text-lg font-semibold">
                  {t('progress', {
                    done: data.progress[stage].done,
                    total: data.progress[stage].total,
                  })}
                </dd>
              </div>
            ))}
          </dl>
          {data.award && (
            <p role="status" className="rounded-md border border-primary bg-selected p-4">
              {t('awardedTo', { name: data.award.supplier.legalName })}{' '}
              <span className="text-sm text-muted-foreground">
                ({t(`selection.${data.award.selection}`)},{' '}
                {formatDateTime(locale, data.award.awardedAt)})
              </span>
            </p>
          )}
          {data.awardStatus === 'cancelled' && data.cancellationReason && (
            <p className="rounded-md border border-border p-4 text-sm">
              {t(`cancelled.${data.cancellationReason}`)}
            </p>
          )}
          {data.awardStatus === 'tie_break_required' && (
            <p className="panel border-advisory-border bg-advisory p-4 text-sm">{t('tieHint')}</p>
          )}
        </>
      )}
      {failure && (
        <ErrorState title={t.has(`failures.${failure}`) ? t(`failures.${failure}`) : t('failed')} />
      )}
      {ranking.data &&
        (ranking.data.data.length ? (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-start text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  {[
                    'rank',
                    'supplier',
                    'technical',
                    'financial',
                    'combined',
                    'balance',
                    'action',
                  ].map((col) => (
                    <th key={col} scope="col" className="px-4 py-3 text-start">
                      {t(`columns.${col}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ranking.data.data.map((row) => (
                  <tr key={row.bidId}>
                    <td className="px-4 py-3 font-semibold">{row.rank}</td>
                    <td className="px-4 py-3" dir="auto">
                      {row.supplier.legalName}
                    </td>
                    <td className="px-4 py-3">{row.technicalScore}</td>
                    <td className="px-4 py-3">{row.financialScore}</td>
                    <td className="px-4 py-3 font-semibold">{row.combinedScore}</td>
                    <td className="px-4 py-3">
                      {row.aboveEstimatedBalance ? (
                        <Badge variant="destructive">{t('aboveBalance')}</Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {candidates.has(row.bidId) &&
                        (choosing === row.bidId ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <Button disabled={busy} onClick={() => void choose(row.bidId)}>
                              {t('confirm')}
                            </Button>
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                setChoosing(null);
                                returnTo(row.bidId);
                              }}
                            >
                              {t('cancel')}
                            </Button>
                          </span>
                        ) : (
                          <Button
                            ref={register('table', row.bidId)}
                            variant="outline"
                            onClick={() => setChoosing(row.bidId)}
                          >
                            {t('chooseWinner')}
                          </Button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          data?.awardStatus === 'in_progress' && <EmptyState title={t('noRanking')} />
        ))}
    </section>
  );
}
