'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useOfficerEmailEdit,
  useOfficerEmailSend,
  useTenderEmailsList,
  useTenderEmailsSendAll,
} from '@/lib/api/generated/emails/emails';
import type { OfficerEmail, TenderStatus } from '@/lib/api/generated/model';
import { ApiError } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/lib/useSession';

// Poll every 3 seconds while an email is sending, for at most 60 seconds
// (API_CONTRACT.md, Emails).
const POLL_MS = 3_000;
const POLL_LIMIT_MS = 60_000;

// E1–E5: the award or cancellation emails the procurement_officer reviews,
// edits and sends. Each preview uses the email's own language and direction.
export function TenderEmails({ tenderId, status }: { tenderId: string; status: TenderStatus }) {
  const t = useTranslations('OfficerEmails');
  const { session } = useSession();
  const client = useQueryClient();
  const kind = status === 'awarded' ? 'award' : status === 'cancelled' ? 'cancellation' : null;
  const [pollSince, setPollSince] = useState<number | null>(null);
  const [stalled, setStalled] = useState(false);
  const queryKey = privateKey(session?.user.id ?? '', ['officer-emails', tenderId, kind]);
  const query = useTenderEmailsList(
    tenderId,
    { kind: kind ?? 'award', page: 1, limit: 100 },
    {
      query: {
        queryKey,
        enabled: !!session && kind !== null,
        retry: false,
        refetchInterval: (q) => {
          const sending = q.state.data?.data.some((e) => e.status === 'sending');
          if (!sending || pollSince === null) return false;
          if (Date.now() - pollSince > POLL_LIMIT_MS) {
            setStalled(true);
            return false;
          }
          return POLL_MS;
        },
      },
    },
  );
  const sendAll = useTenderEmailsSendAll<ApiError>();
  const [failure, setFailure] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  if (!kind) return null;
  const refresh = async () => {
    setStalled(false);
    setPollSince(Date.now());
    await client.invalidateQueries({ queryKey });
  };

  async function sendEvery(emails: OfficerEmail[]) {
    setFailure(null);
    try {
      const result = await sendAll.mutateAsync({
        tenderId,
        data: {
          kind: kind!,
          revisions: Object.fromEntries(
            emails
              .filter((e) => e.status === 'draft' || e.status === 'failed')
              .map((e) => [e.id, e.revision]),
          ),
        },
      });
      setSummary(
        t('sentSummary', { sending: result.sending.length, skipped: result.skipped.length }),
      );
      await refresh();
    } catch (error) {
      setFailure(error instanceof ApiError ? error.code : 'UNKNOWN_ERROR');
    }
  }

  const emails = query.data?.data ?? [];
  const pending = emails.some((e) => e.status === 'draft' || e.status === 'failed');
  return (
    <section className="panel mt-6 space-y-4 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{t(`titles.${kind}`)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('hint')}</p>
        </div>
        {pending && (
          <Button disabled={sendAll.isPending} onClick={() => void sendEvery(emails)}>
            {t('sendAll')}
          </Button>
        )}
      </header>
      {summary && (
        <p role="status" className="text-sm font-semibold text-primary">
          {summary}
        </p>
      )}
      {stalled && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('stillSending')}
        </p>
      )}
      {failure && <ErrorState title={t('failed')} />}
      {query.isPending && <Skeleton className="h-40" />}
      {query.isError && (
        <ErrorState
          title={t('loadFailed')}
          action={<Button onClick={() => void query.refetch()}>{t('retry')}</Button>}
        />
      )}
      {query.data &&
        (emails.length ? (
          <ul className="space-y-4">
            {emails.map((email) => (
              <EmailItem key={email.id} email={email} refresh={refresh} />
            ))}
          </ul>
        ) : (
          <EmptyState title={t('empty')} />
        ))}
    </section>
  );
}

function EmailItem({ email, refresh }: { email: OfficerEmail; refresh: () => Promise<void> }) {
  const t = useTranslations('OfficerEmails');
  const locale = useLocale();
  const edit = useOfficerEmailEdit<ApiError>();
  const send = useOfficerEmailSend<ApiError>();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [failure, setFailure] = useState<string | null>(null);
  const editable = email.status === 'draft' || email.status === 'failed';

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);
    if (!subject.trim() || !body.trim()) return setFailure('REQUIRED');
    try {
      await edit.mutateAsync({
        emailId: email.id,
        data: { subject: subject.trim(), body, revision: email.revision },
      });
      setEditing(false);
      await refresh();
    } catch (error) {
      setFailure(error instanceof ApiError ? error.code : 'UNKNOWN_ERROR');
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') await refresh();
    }
  }

  async function deliver() {
    setFailure(null);
    try {
      await send.mutateAsync({ emailId: email.id, data: { revision: email.revision } });
      await refresh();
    } catch (error) {
      setFailure(error instanceof ApiError ? error.code : 'UNKNOWN_ERROR');
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') await refresh();
    }
  }

  return (
    <li className="space-y-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold" dir="auto">
            {email.recipient.legalName}{' '}
            <span className="text-sm font-normal text-muted-foreground" dir="ltr">
              {email.recipient.email}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {t(`kinds.${email.kind}`)} · {email.language.toUpperCase()} ·{' '}
            {t('revision', { revision: email.revision })}
            {email.sentAt
              ? ` · ${t('sentAt', { when: formatDateTime(locale, email.sentAt) })}`
              : ''}
          </p>
        </div>
        <Badge
          variant={
            email.status === 'failed'
              ? 'destructive'
              : email.status === 'sent'
                ? 'default'
                : 'secondary'
          }
        >
          {t(`statuses.${email.status}`)}
        </Badge>
      </div>

      {editing ? (
        <form noValidate onSubmit={(e) => void save(e)} className="space-y-3" lang={email.language}>
          <div className="space-y-1">
            <label htmlFor={`subject-${email.id}`} className="block text-sm font-semibold">
              {t('subject')}
            </label>
            <input
              id={`subject-${email.id}`}
              dir={email.dir}
              maxLength={300}
              value={subject}
              disabled={edit.isPending}
              onChange={(e) => setSubject(e.target.value)}
              className="field-control"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`body-${email.id}`} className="block text-sm font-semibold">
              {t('body')}
            </label>
            <textarea
              id={`body-${email.id}`}
              dir={email.dir}
              rows={8}
              maxLength={10000}
              value={body}
              disabled={edit.isPending}
              onChange={(e) => setBody(e.target.value)}
              className="field-control"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={edit.isPending}>
              {t('save')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={edit.isPending}
              onClick={() => {
                setEditing(false);
                setSubject(email.subject);
                setBody(email.body);
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <div lang={email.language} dir={email.dir} className="rounded-md bg-muted p-3 text-sm">
          <p className="font-semibold">{email.subject}</p>
          <p className="mt-2 whitespace-pre-line">{email.body}</p>
        </div>
      )}

      {email.failure && (
        <p className="text-sm text-destructive">
          {t('failure', { when: formatDateTime(locale, email.failure.at) })}
        </p>
      )}
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {t.has(`errors.${failure}`) ? t(`errors.${failure}`) : t('failed')}
        </p>
      )}
      {editable && !editing && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            {t('edit')}
          </Button>
          <Button disabled={send.isPending} onClick={() => void deliver()}>
            {t(email.status === 'failed' ? 'retrySend' : 'send')}
          </Button>
        </div>
      )}
    </li>
  );
}
