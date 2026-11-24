'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ErrorState } from '@/components/layout/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import type {
  DownloadLink,
  EvaluationDocument,
  FinancialBidView,
  LegalBidView,
  TechnicalBidView,
} from '@/lib/api/generated/model';
import { ApiError, apiFetch, apiUrl } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { formatDateTime, languageName } from '@/lib/format';
import { useSession } from '@/lib/useSession';
import { QueueError } from './EvaluationQueue';
import { SignInRequired } from './SignInRequired';
import { isStage, STAGE_URLS, type Stage } from './stages';

type BidView = LegalBidView | TechnicalBidView | FinancialBidView;

// L2–L4, X2–X4, F2–F4: one bid, its documents, and the stage's form or its
// saved result. Technical and financial screens never name the supplier.
export function EvaluationBid() {
  const t = useTranslations('Evaluations');
  const { stage, tenderId, bidRef } = useParams<{
    stage: string;
    tenderId: string;
    bidRef: string;
  }>();
  const ref = decodeURIComponent(bidRef);
  const { session, isLoading } = useSession();
  const valid = isStage(stage);
  const key = privateKey(session?.user.id ?? '', ['evaluations', stage, tenderId, 'bid', ref]);
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<BidView>(STAGE_URLS[valid ? stage : 'legal'].detail(tenderId, ref)),
    enabled: !!session && valid,
    retry: false,
  });
  if (isLoading) return <Skeleton className="h-80" />;
  if (!session) return <SignInRequired />;
  if (!valid || query.isError)
    return <QueueError error={query.error} retry={() => void query.refetch()} />;
  if (query.isPending) return <Skeleton className="h-80" />;
  const bid = query.data;
  const s = stage as Stage;
  const title = 'supplier' in bid ? bid.supplier.legalName : t('bidder', { code: bid.bidderCode });

  return (
    <article className="max-w-3xl space-y-5">
      <header className="space-y-2">
        <Link
          href={`/evaluations/${s}/tenders/${tenderId}`}
          className="text-sm text-primary underline underline-offset-4"
        >
          {t('backToQueue')}
        </Link>
        <h1 className="text-2xl font-bold" dir="auto">
          {title}
        </h1>
        {'supplier' in bid && (
          <p className="text-sm text-muted-foreground">
            {t('registration', { number: bid.supplier.registrationNumber })}
          </p>
        )}
      </header>

      {'legalInformation' in bid && (
        <section className="panel space-y-2 p-5">
          <h2 className="text-lg font-bold">{t('legalInformation')}</h2>
          <p className="text-sm">
            {t('signatory')}:{' '}
            <span dir="auto">{String(bid.legalInformation.authorizedSignatoryName ?? '—')}</span>
          </p>
        </section>
      )}

      {bid.answers.length > 0 && (
        <section className="panel space-y-2 p-5">
          <h2 className="text-lg font-bold">{t('answers')}</h2>
          <dl className="divide-y divide-border">
            {bid.answers.map((a) => (
              <div key={a.fieldId} className="flex flex-wrap justify-between gap-3 py-2 text-sm">
                <dt className="font-semibold">{a.label}</dt>
                <dd dir="auto">
                  {typeof a.value === 'boolean'
                    ? t(a.value ? 'yes' : 'no')
                    : String(a.value ?? '—')}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="panel space-y-2 p-5">
        <h2 className="text-lg font-bold">{t('documents')}</h2>
        <ul className="divide-y divide-border">
          {bid.documents.map((doc) => (
            <DocumentRow key={doc.id} stage={s} tenderId={tenderId} bidRef={ref} doc={doc} />
          ))}
        </ul>
      </section>

      {bid.evaluation ? (
        <SavedEvaluation stage={s} evaluation={bid.evaluation} currency={currencyOf(bid)} />
      ) : bid.allowedActions.includes('submit') ? (
        <EvaluationForm stage={s} tenderId={tenderId} bidRef={ref} queryKey={key} bid={bid} />
      ) : (
        <p className="panel p-5 text-sm text-muted-foreground">{t('readOnly')}</p>
      )}
    </article>
  );
}

function currencyOf(bid: BidView): string | null {
  return 'tenderCurrency' in bid ? bid.tenderCurrency : null;
}

function DocumentRow({
  stage,
  tenderId,
  bidRef,
  doc,
}: {
  stage: Stage;
  tenderId: string;
  bidRef: string;
  doc: EvaluationDocument;
}) {
  const t = useTranslations('Evaluations');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function open() {
    setFailed(false);
    setBusy(true);
    try {
      const link = await apiFetch<DownloadLink>(
        STAGE_URLS[stage].download(tenderId, bidRef, doc.id),
      );
      window.location.assign(apiUrl(link.url));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold break-words" dir="auto">
          {doc.name}
        </p>
        <p className="text-xs text-muted-foreground">{languageName(locale, doc.language)}</p>
      </div>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void open()}>
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

type Saved = BidView['evaluation'];

function SavedEvaluation({
  stage,
  evaluation,
  currency,
}: {
  stage: Stage;
  evaluation: NonNullable<Saved>;
  currency: string | null;
}) {
  const t = useTranslations('Evaluations');
  const locale = useLocale();
  const rows: [string, string][] = [];
  if ('outcome' in evaluation) {
    rows.push([t('outcome'), t(`outcomes.${evaluation.outcome}`)]);
    if (evaluation.reason) rows.push([t('reason'), evaluation.reason]);
  }
  if ('technicalScore' in evaluation)
    rows.push([t('technicalScore'), String(evaluation.technicalScore)]);
  if ('financialScore' in evaluation) {
    rows.push([t('financialScore'), String(evaluation.financialScore)]);
    rows.push([
      t('confirmedTotalPrice'),
      `${evaluation.confirmedTotalPrice} ${currency ?? ''}`.trim(),
    ]);
  }
  if ('comments' in evaluation && evaluation.comments)
    rows.push([t('comments'), evaluation.comments]);
  return (
    <section className="panel space-y-3 p-5" aria-label={t(`forms.${stage}`)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t('savedTitle')}</h2>
        <Badge variant="secondary">
          {t('submittedAt', { when: formatDateTime(locale, evaluation.submittedAt) })}
        </Badge>
      </div>
      <dl className="divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-2 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
            <dt className="font-semibold">{label}</dt>
            <dd dir="auto" className="break-words">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function EvaluationForm({
  stage,
  tenderId,
  bidRef,
  queryKey,
  bid,
}: {
  stage: Stage;
  tenderId: string;
  bidRef: string;
  queryKey: readonly unknown[];
  bid: BidView;
}) {
  const t = useTranslations('Evaluations');
  const client = useQueryClient();
  const [outcome, setOutcome] = useState<'pass' | 'fail' | ''>('');
  const [reason, setReason] = useState('');
  const [score, setScore] = useState('');
  const [price, setPrice] = useState('');
  const [comments, setComments] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function check(): Record<string, string> {
    const e: Record<string, string> = {};
    if (stage === 'legal') {
      if (!outcome) e.outcome = 'REQUIRED';
      if (outcome === 'fail' && !reason.trim()) e.reason = 'REQUIRED';
    } else {
      const n = Number(score);
      if (score.trim() === '' || !Number.isInteger(n) || n < 0 || n > 100) e.score = 'SCORE';
      if (stage === 'financial' && !/^\d{1,12}(\.\d{1,2})?$/.test(price.trim())) e.price = 'PRICE';
    }
    return e;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);
    const local = check();
    setErrors(local);
    if (Object.keys(local).length) return;
    const body =
      stage === 'legal'
        ? { outcome, reason: outcome === 'fail' ? reason.trim() : null }
        : stage === 'technical'
          ? {
              technicalScore: Number(score),
              ...(comments.trim() ? { comments: comments.trim() } : {}),
            }
          : {
              financialScore: Number(score),
              confirmedTotalPrice: price.trim(),
              ...(comments.trim() ? { comments: comments.trim() } : {}),
            };
    setBusy(true);
    try {
      await apiFetch(STAGE_URLS[stage].submit(tenderId, bidRef), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await client.invalidateQueries({ queryKey });
      // The queue and My assignments counts change too.
      await client.invalidateQueries({ queryKey: queryKey.slice(0, 5) });
      await client.invalidateQueries({ queryKey: queryKey.slice(0, 2).concat('assignments') });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ALREADY_SUBMITTED') {
        // Someone on the committee saved it first: show the saved result.
        await client.invalidateQueries({ queryKey });
        return;
      }
      if (error instanceof ApiError && error.code === 'VALIDATION_FAILED' && error.fields.length) {
        setErrors(
          Object.fromEntries(
            error.fields.map((f) => [
              f.field === 'technicalScore' || f.field === 'financialScore'
                ? 'score'
                : f.field === 'confirmedTotalPrice'
                  ? 'price'
                  : f.field,
              f.code === 'REQUIRED' ? 'REQUIRED' : 'INVALID',
            ]),
          ),
        );
      } else setFailure(error instanceof ApiError ? error.code : 'UNKNOWN_ERROR');
    } finally {
      setBusy(false);
    }
  }

  const error = (field: string) =>
    errors[field] ? (
      <p role="alert" className="text-sm text-destructive">
        {t(`errors.${errors[field]}`)}
      </p>
    ) : null;

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="panel space-y-4 p-5">
      <h2 className="text-lg font-bold">{t(`forms.${stage}`)}</h2>
      {stage === 'legal' ? (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">{t('outcome')}</legend>
            <div className="flex flex-wrap gap-4">
              {(['pass', 'fail'] as const).map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="outcome"
                    value={value}
                    checked={outcome === value}
                    disabled={busy}
                    onChange={() => setOutcome(value)}
                    className="size-4 accent-primary"
                  />
                  {t(`outcomes.${value}`)}
                </label>
              ))}
            </div>
            {error('outcome')}
          </fieldset>
          {outcome === 'fail' && (
            <div className="space-y-1">
              <label htmlFor="evaluation-reason" className="block text-sm font-semibold">
                {t('reason')} *
              </label>
              <textarea
                id="evaluation-reason"
                rows={4}
                maxLength={2000}
                dir="auto"
                value={reason}
                disabled={busy}
                aria-invalid={!!errors.reason}
                onChange={(e) => setReason(e.target.value)}
                className="field-control"
              />
              {error('reason')}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="space-y-1">
            <label htmlFor="evaluation-score" className="block text-sm font-semibold">
              {t(stage === 'technical' ? 'technicalScore' : 'financialScore')} *
            </label>
            <input
              id="evaluation-score"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={score}
              disabled={busy}
              aria-invalid={!!errors.score}
              onChange={(e) => setScore(e.target.value)}
              className="field-control w-32"
            />
            <p className="text-xs text-muted-foreground">{t('scoreHint')}</p>
            {error('score')}
          </div>
          {stage === 'financial' && (
            <div className="space-y-1">
              <label htmlFor="evaluation-price" className="block text-sm font-semibold">
                {t('confirmedTotalPrice')} ({currencyOf(bid)}) *
              </label>
              <input
                id="evaluation-price"
                inputMode="decimal"
                dir="ltr"
                value={price}
                disabled={busy}
                aria-invalid={!!errors.price}
                onChange={(e) => setPrice(e.target.value)}
                className="field-control w-48"
              />
              {error('price')}
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="evaluation-comments" className="block text-sm font-semibold">
              {t('comments')}
            </label>
            <textarea
              id="evaluation-comments"
              rows={4}
              maxLength={2000}
              dir="auto"
              value={comments}
              disabled={busy}
              onChange={(e) => setComments(e.target.value)}
              className="field-control"
            />
          </div>
        </>
      )}
      <p className="text-sm text-muted-foreground">{t('finalHint')}</p>
      {failure && (
        <ErrorState title={t.has(`failures.${failure}`) ? t(`failures.${failure}`) : t('failed')} />
      )}
      <Button type="submit" disabled={busy}>
        {t(busy ? 'submitting' : 'submit')}
      </Button>
    </form>
  );
}
