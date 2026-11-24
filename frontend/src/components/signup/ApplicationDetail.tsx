'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ApplicationDocumentView, SignupDecision } from '@/lib/api/generated/model';
import {
  useLegalApplicationsDetail,
  useLegalApplicationsDownload,
  useLegalApplicationsReview,
  useSignupRequestsDetail,
  useSignupRequestsAccept,
} from '@/lib/api/generated/sign-up/sign-up';
import { ApiError, apiUrl } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { formatDateTime, languageName } from '@/lib/format';
import { useSession } from '@/lib/useSession';
import { SignupApplicationFields, SignupField, signupControl } from './SignupFields';
import { BackLink } from '@/components/ui/back-link';

function LegalApplicationDocument({
  applicationId,
  document,
}: {
  applicationId: string;
  document: ApplicationDocumentView;
}) {
  const t = useTranslations('Signup');
  const locale = useLocale();
  const { session } = useSession();
  const client = useQueryClient();
  const [failed, setFailed] = useState(false);
  const key = privateKey(session?.user.id ?? '', [
    'signup',
    locale,
    'download',
    applicationId,
    document.id,
  ]);
  const query = useLegalApplicationsDownload(applicationId, document.id, {
    query: { queryKey: key, enabled: false, retry: false, gcTime: 0 },
  });
  async function download() {
    setFailed(false);
    try {
      const result = await query.refetch();
      if (result.error || !result.data) {
        setFailed(true);
        return;
      }
      window.location.assign(apiUrl(result.data.url));
    } catch {
      setFailed(true);
    } finally {
      client.removeQueries({ queryKey: key, exact: true });
    }
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium" dir="auto">
          {document.name}
        </p>
        <p className="text-xs text-muted-foreground">{languageName(locale, document.language)}</p>
      </div>
      <Button variant="outline" disabled={query.isFetching} onClick={() => void download()}>
        {t('download')}
      </Button>
      {failed && (
        <p role="alert" className="w-full text-sm text-destructive">
          {t('downloadFailed')}
        </p>
      )}
    </li>
  );
}
export function LegalDecisionForm({ applicationId }: { applicationId: string }) {
  const t = useTranslations('Signup');
  const { session } = useSession();
  const client = useQueryClient();
  const mutation = useLegalApplicationsReview<ApiError>({ mutation: { retry: false, gcTime: 0 } });
  const [decision, setDecision] = useState<SignupDecision | ''>('');
  const [reason, setReason] = useState('');
  const [reasonInvalid, setReasonInvalid] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saved, setSaved] = useState<SignupDecision | 'unknown' | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision || !confirmed || saved || mutation.isPending) return;
    setFailure(null);
    setReasonInvalid(false);
    if (reason.trim().length > 2000) {
      setReasonInvalid(true);
      setFailure('VALIDATION_FAILED');
      return;
    }
    try {
      const result = await mutation.mutateAsync({
        applicationId,
        data: { decision, reason: reason.trim() || null },
      });
      setSaved(result.decision);
      await client.invalidateQueries({ queryKey: privateKey(session?.user.id ?? '', ['signup']) });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ALREADY_SUBMITTED') {
        const previous = error.details.decision;
        setSaved(previous === 'accepted' || previous === 'rejected' ? previous : 'unknown');
        await client.invalidateQueries({
          queryKey: privateKey(session?.user.id ?? '', ['signup']),
        });
      } else {
        setReasonInvalid(
          error instanceof ApiError && error.fields.some((field) => field.field === 'reason'),
        );
        setFailure(error instanceof ApiError ? error.code : 'UNKNOWN_ERROR');
      }
    }
  }
  if (saved)
    return (
      <div role="status" className="space-y-2 rounded-md bg-secondary p-4">
        <p className="font-semibold">{t(saved === 'unknown' ? 'alreadySubmitted' : saved)}</p>
        {saved !== 'unknown' && (
          <p className="text-sm">{t(saved === 'accepted' ? 'raisedHint' : 'rejectedHint')}</p>
        )}
        <p className="text-xs">{t('decisionFinal')}</p>
      </div>
    );
  const errorLabels: Record<string, string> = {
    VALIDATION_FAILED: 'invalid',
    NOT_FOUND: 'notFound',
    RATE_LIMITED: 'rateLimited',
  };
  return (
    <form onSubmit={submit} className="space-y-4 panel p-5">
      <h2 className="font-bold">{t('legalDecision')}</h2>
      {failure && <ErrorState title={t(errorLabels[failure] ?? 'decisionFailed')} />}
      <fieldset disabled={mutation.isPending || failure === 'NOT_FOUND'} className="space-y-4">
        <SignupField label={t('decision')}>
          <select
            className={signupControl}
            value={decision}
            onChange={(event) => {
              setDecision(event.target.value as SignupDecision | '');
              setConfirmed(false);
            }}
          >
            <option value="">{t('chooseDecision')}</option>
            <option value="accepted">{t('accept')}</option>
            <option value="rejected">{t('reject')}</option>
          </select>
        </SignupField>
        <SignupField label={t('reason')} error={reasonInvalid ? t('invalidField') : undefined}>
          <textarea
            className={signupControl}
            rows={3}
            maxLength={2000}
            aria-invalid={reasonInvalid}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </SignupField>
        <label className="flex items-start gap-3 text-sm">
          <input
            className="mt-1"
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          {t('confirmDecision')}
        </label>
        <Button type="submit" disabled={mutation.isPending || !decision || !confirmed}>
          {t(mutation.isPending ? 'saving' : 'saveDecision')}
        </Button>
      </fieldset>
    </form>
  );
}
function DetailFailure({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations('Signup');
  return error instanceof ApiError && error.status === 404 ? (
    <EmptyState title={t('notFound')} />
  ) : (
    <ErrorState title={t('loadFailed')} action={<Button onClick={retry}>{t('retry')}</Button>} />
  );
}
export function LegalApplicationDetail({ applicationId }: { applicationId: string }) {
  const t = useTranslations('Signup');
  const locale = useLocale();
  const { session } = useSession();
  const query = useLegalApplicationsDetail(applicationId, {
    query: {
      queryKey: privateKey(session?.user.id ?? '', [
        'signup',
        locale,
        'legal-detail',
        applicationId,
      ]),
      enabled: !!session,
      retry: false,
    },
  });
  if (query.isPending) return <Skeleton className="h-64" />;
  if (query.isError)
    return <DetailFailure error={query.error} retry={() => void query.refetch()} />;
  return (
    <article className="space-y-5">
      <BackLink href="/signup-reviews">{t('backQueue')}</BackLink>
      <h1 className="text-2xl font-bold">{t('legalDetail')}</h1>
      <section className="panel p-5">
        <SignupApplicationFields application={query.data} />
      </section>
      <section className="panel p-5">
        <h2 className="font-bold">{t('documents')}</h2>
        <ul>
          {query.data.documents.map((document) => (
            <LegalApplicationDocument
              key={document.id}
              applicationId={applicationId}
              document={document}
            />
          ))}
        </ul>
      </section>
      <LegalDecisionForm key={applicationId} applicationId={applicationId} />
    </article>
  );
}
export function AdminRequestDetail({ applicationId }: { applicationId: string }) {
  const t = useTranslations('Signup');
  const locale = useLocale();
  const { session } = useSession();
  const client = useQueryClient();
  const isAdmin = session?.user.roles.includes('admin') ?? false;
  const accepting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [acceptedLanguage, setAcceptedLanguage] = useState<'en' | 'ar' | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const mutation = useSignupRequestsAccept<ApiError>({ mutation: { retry: false, gcTime: 0 } });
  const query = useSignupRequestsDetail(applicationId, {
    query: {
      queryKey: privateKey(session?.user.id ?? '', [
        'signup',
        locale,
        'admin-detail',
        applicationId,
      ]),
      enabled: isAdmin,
      retry: false,
    },
  });
  async function accept() {
    if (!isAdmin || accepting.current || acceptedLanguage || failure === 'ALREADY_ACCEPTED') return;
    accepting.current = true;
    setBusy(true);
    setFailure(null);
    let refresh = false;
    try {
      const result = await mutation.mutateAsync({ applicationId });
      setAcceptedLanguage(result.setupEmail.language);
      refresh = true;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
      setFailure(code);
      refresh = [
        'ALREADY_ACCEPTED',
        'EMAIL_ALREADY_REGISTERED',
        'REGISTRATION_NUMBER_EXISTS',
      ].includes(code);
    } finally {
      if (refresh) {
        // Invalidate every cached locale for this admin, without touching another user's data.
        await client.invalidateQueries({
          queryKey: privateKey(session?.user.id ?? '', ['signup']),
          predicate: ({ queryKey }) =>
            queryKey[4] === 'admin-queue' ||
            (queryKey[4] === 'admin-detail' && queryKey[5] === applicationId),
          refetchType: 'none',
        });
        await Promise.allSettled([
          client.refetchQueries({
            queryKey: privateKey(session?.user.id ?? '', ['signup']),
            predicate: ({ queryKey }) => queryKey[4] === 'admin-queue',
            type: 'active',
          }),
          query.refetch(),
        ]);
      }
      accepting.current = false;
      setBusy(false);
    }
  }
  const errors: Record<string, string> = {
    ALREADY_ACCEPTED: 'alreadyAccepted',
    EMAIL_ALREADY_REGISTERED: 'emailRegistered',
    REGISTRATION_NUMBER_EXISTS: 'registrationExists',
    NOT_FOUND: 'notFound',
    RATE_LIMITED: 'rateLimited',
  };
  const outcome = acceptedLanguage ? (
    <p role="status" className="rounded-md border border-primary/30 bg-secondary p-4 text-primary">
      {t('adminAccepted', { language: languageName(locale, acceptedLanguage) })}
    </p>
  ) : failure ? (
    <ErrorState title={t(errors[failure] ?? 'adminAcceptFailed')} />
  ) : null;
  if (!isAdmin) return <EmptyState title={t('notFound')} />;
  // Keep the acceptance outcome visible when refetch removes the now-accepted request (404).
  if (acceptedLanguage || failure === 'ALREADY_ACCEPTED')
    return (
      <article className="space-y-5">
        <BackLink href="/signup-requests">{t('backQueue')}</BackLink>
        <h1 className="text-2xl font-bold">{t('adminDetail')}</h1>
        {outcome}
      </article>
    );
  if (query.isPending) return <Skeleton className="h-64" />;
  if (query.isError)
    return (
      <div className="space-y-4">
        {outcome}
        <DetailFailure error={query.error} retry={() => void query.refetch()} />
      </div>
    );
  return (
    <article className="space-y-5">
      <BackLink href="/signup-requests">{t('backQueue')}</BackLink>
      <h1 className="text-2xl font-bold">{t('adminDetail')}</h1>
      {outcome}
      <section className="panel p-5">
        <SignupApplicationFields application={query.data} />
      </section>
      <section className="space-y-4 panel p-5">
        <h2 className="font-bold">{t('acceptedReview')}</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t('decision')}</dt>
            <dd>{t('accepted')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('reviewedAt')}</dt>
            <dd>
              <time dateTime={query.data.review.decidedAt}>
                {formatDateTime(locale, query.data.review.decidedAt)}
              </time>
            </dd>
          </div>
          {query.data.review.reason && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t('reviewNote')}</dt>
              <dd className="whitespace-pre-line" dir="auto">
                {query.data.review.reason}
              </dd>
            </div>
          )}
        </dl>
        <p className="text-sm text-muted-foreground">{t('adminAcceptHint')}</p>
        <Button type="button" disabled={busy || mutation.isPending} onClick={() => void accept()}>
          {t(busy || mutation.isPending ? 'saving' : 'adminAccept')}
        </Button>
      </section>
    </article>
  );
}
export function LegalApplicationFromRoute() {
  const { applicationId } = useParams<{ applicationId: string }>();
  return <LegalApplicationDetail key={applicationId} applicationId={applicationId} />;
}
export function AdminRequestFromRoute() {
  const { applicationId } = useParams<{ applicationId: string }>();
  return <AdminRequestDetail key={applicationId} applicationId={applicationId} />;
}
