'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState } from '@/components/layout/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useNominationsWithdraw,
  useTenderCommitteesList,
  useTenderCommitteesNominate,
  useTenderCommitteesRaise,
} from '@/lib/api/generated/committees/committees';
import type { CommitteeType, CommitteeView, TenderStatus } from '@/lib/api/generated/model';
import { ApiError } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { useSession } from '@/lib/useSession';

const TYPES: CommitteeType[] = ['legal_committee', 'technical_committee', 'financial_committee'];
const STAFFING: TenderStatus[] = ['accepted', 'published', 'closed'];

// C1–C4 on the managed tender page (API_CONTRACT.md, Committees).
export function TenderCommittees({ tenderId, status }: { tenderId: string; status: TenderStatus }) {
  const t = useTranslations('Committees');
  const { session } = useSession();
  const client = useQueryClient();
  const queryKey = privateKey(session?.user.id ?? '', ['committees', tenderId]);
  const query = useTenderCommitteesList(
    tenderId,
    { page: 1, limit: 20 },
    { query: { queryKey, enabled: !!session, retry: false } },
  );
  const raise = useTenderCommitteesRaise<ApiError>();
  const [failed, setFailed] = useState<string | null>(null);
  const open = STAFFING.includes(status);
  const refresh = () => client.invalidateQueries({ queryKey });

  async function raiseCommittee(type: CommitteeType) {
    setFailed(null);
    try {
      await raise.mutateAsync({ tenderId, data: { type } });
      await refresh();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.code : 'UNKNOWN_ERROR');
    }
  }

  return (
    <section className="panel mt-6 space-y-5 p-6">
      <header>
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t(open ? 'hint' : 'closedHint')}</p>
      </header>
      {failed && (
        <ErrorState title={t(failed === 'TENDER_STATUS_CHANGED' ? 'statusChanged' : 'failed')} />
      )}
      {query.isPending && <Skeleton className="h-32" />}
      {query.isError && (
        <ErrorState
          title={t('loadFailed')}
          action={<Button onClick={() => void query.refetch()}>{t('retry')}</Button>}
        />
      )}
      {query.data && (
        <ul className="space-y-4">
          {TYPES.map((type) => {
            const committee = query.data.data.find((c) => c.type === type);
            return (
              <li key={type} className="rounded-md border border-input p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">{t(`types.${type}`)}</h3>
                  {!committee && open && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={raise.isPending}
                      onClick={() => void raiseCommittee(type)}
                    >
                      {t('raise')}
                    </Button>
                  )}
                  {!committee && !open && (
                    <span className="text-sm text-muted-foreground">{t('notRaised')}</span>
                  )}
                </div>
                {committee && (
                  <CommitteeMembers
                    tenderId={tenderId}
                    committee={committee}
                    open={open}
                    refresh={refresh}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CommitteeMembers({
  tenderId,
  committee,
  open,
  refresh,
}: {
  tenderId: string;
  committee: CommitteeView;
  open: boolean;
  refresh: () => Promise<void>;
}) {
  const t = useTranslations('Committees');
  const nominate = useTenderCommitteesNominate<ApiError>();
  const withdraw = useNominationsWithdraw<ApiError>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const id = `nominate-${committee.type}`;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setFailed(false);
    const missing: Record<string, string> = {};
    if (!name.trim()) missing.nomineeName = 'REQUIRED';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) missing.nomineeEmail = 'INVALID';
    if (Object.keys(missing).length) return setErrors(missing);
    try {
      await nominate.mutateAsync({
        tenderId,
        type: committee.type,
        data: { nomineeName: name.trim(), nomineeEmail: email.trim() },
      });
      setName('');
      setEmail('');
      await refresh();
    } catch (e) {
      if (e instanceof ApiError && e.fields.length)
        setErrors(Object.fromEntries(e.fields.map((f) => [f.field, f.code])));
      else setFailed(true);
    }
  }

  async function remove(nominationId: string) {
    setFailed(false);
    try {
      await withdraw.mutateAsync({ nominationId });
      await refresh();
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {committee.nominations.length ? (
        <ul className="divide-y divide-border">
          {committee.nominations.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span dir="auto">{n.nomineeName}</span>
              <span className="flex items-center gap-2">
                <Badge variant={n.status === 'rejected' ? 'destructive' : 'secondary'}>
                  {t(`status.${n.status}`)}
                </Badge>
                {n.status === 'nominated' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={withdraw.isPending}
                    onClick={() => void remove(n.id)}
                  >
                    {t('withdraw')}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('noMembers')}</p>
      )}
      {open && (
        <form
          noValidate
          onSubmit={(e) => void submit(e)}
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        >
          {(['nomineeName', 'nomineeEmail'] as const).map((field) => (
            <div key={field} className="space-y-1">
              <label htmlFor={`${id}-${field}`} className="block text-sm font-semibold">
                {t(`fields.${field}`)}
              </label>
              <input
                id={`${id}-${field}`}
                type={field === 'nomineeEmail' ? 'email' : 'text'}
                dir={field === 'nomineeEmail' ? 'ltr' : 'auto'}
                maxLength={field === 'nomineeEmail' ? 254 : 200}
                value={field === 'nomineeEmail' ? email : name}
                aria-invalid={!!errors[field]}
                disabled={nominate.isPending}
                onChange={(e) => (field === 'nomineeEmail' ? setEmail : setName)(e.target.value)}
                className="field-control"
              />
              {errors[field] && (
                <p role="alert" className="text-sm text-destructive">
                  {t(errors[field] === 'REQUIRED' ? 'errors.required' : 'errors.invalid')}
                </p>
              )}
            </div>
          ))}
          <Button type="submit" disabled={nominate.isPending}>
            {t('nominate')}
          </Button>
        </form>
      )}
      {failed && <ErrorState title={t('failed')} />}
    </div>
  );
}
