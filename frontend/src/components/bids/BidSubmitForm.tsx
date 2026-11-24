'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useRouter } from '@/i18n/navigation';
import { getTenderBidsSubmitUrl, useTenderBidsForm } from '@/lib/api/generated/bids/bids';
import type { SupplierBid } from '@/lib/api/generated/model';
import { ApiError, apiFetch } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/lib/useSession';
import { serverErrors } from './bid-errors';
import { useBidAction } from './useBidAction';
import {
  BidPartInputs,
  draftAnswers,
  draftErrors,
  emptyDraft,
  type PartDraft,
} from './BidPartInputs';

// B1–B2: the bid form built from the tender's published spec (API_CONTRACT.md, Bids).
export function BidSubmitForm() {
  const t = useTranslations('Bids');
  const locale = useLocale();
  const router = useRouter();
  const client = useQueryClient();
  const { tenderId } = useParams<{ tenderId: string }>();
  const { session, isLoading } = useSession();
  const isSupplier = session?.user.roles.includes('supplier') ?? false;
  const query = useTenderBidsForm(tenderId, {
    query: {
      queryKey: privateKey(session?.user.id ?? '', ['bid-form', locale, tenderId]),
      enabled: isSupplier,
      retry: false,
    },
  });
  const [drafts, setDrafts] = useState<Record<string, PartDraft>>({});
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const action = useBidAction();
  const { busy, blocked } = action;

  if (isLoading) return <Skeleton className="h-80" />;
  if (!isSupplier)
    return (
      <ErrorState
        title={t('suppliersOnly')}
        action={
          <Link href={{ pathname: '/sign-in', query: { returnTo: `/tenders/${tenderId}/bid` } }}>
            {t('signIn')}
          </Link>
        }
      />
    );
  if (query.isPending) return <Skeleton className="h-80" />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        title={t('loadFailed')}
        action={<Button onClick={() => void query.refetch()}>{t('retry')}</Button>}
      />
    );
  const form = query.data;
  if (!form.canSubmit)
    return (
      <section className="panel max-w-2xl space-y-3 p-5">
        <h1 className="text-2xl font-bold">{t('submitTitle')}</h1>
        <p>{t(`reasons.${form.reasonCode ?? 'APPLICATION_CLOSED'}`)}</p>
        {form.existingBid && (
          <Link
            href={`/my-bids/${form.existingBid.bidId}`}
            className="font-semibold text-primary underline"
          >
            {t('viewBid')}
          </Link>
        )}
      </section>
    );

  const draft = (part: string) => drafts[part] ?? emptyDraft();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || blocked) return;
    setFailure(null);
    const local = Object.fromEntries(
      form.parts.map((p) => [p.partType, draftErrors(p, draft(p.partType))]),
    );
    if (Object.values(local).some((e) => Object.keys(e).length)) {
      setErrors(local);
      return;
    }
    setErrors({});
    const body = new FormData();
    const legal = draft('legal_information');
    body.append(
      'bid',
      JSON.stringify({
        legalInformation: Object.fromEntries(
          Object.entries(legal.values).map(([k, v]) => [k, v.trim()]),
        ),
        answers: Object.fromEntries(
          form.parts.map((p) => [p.partType, draftAnswers(p, draft(p.partType))]),
        ),
      }),
    );
    for (const part of form.parts) {
      const d = draft(part.partType);
      for (const [name, file] of Object.entries(d.files)) {
        if (!file) continue;
        body.append(`files[${part.partType}][${name}]`, file);
        body.append(`languages[${part.partType}][${name}]`, d.languages[name] ?? '');
      }
    }
    // One key per deliberate submission, reused on retries (§1.3).
    const requestKey = action.begin();
    if (!requestKey) return;
    let succeeded = false;
    try {
      const bid = await apiFetch<SupplierBid>(getTenderBidsSubmitUrl(tenderId), {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': requestKey },
      });
      await client.invalidateQueries({ queryKey: privateKey(session?.user.id ?? '', ['bids']) });
      succeeded = true;
      router.replace(`/my-bids/${bid.id}`);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
      if (error instanceof ApiError && code === 'VALIDATION_FAILED')
        setErrors(serverErrors(error.fields));
      setFailure(code);
      action.failed(error);
    } finally {
      action.finish(succeeded);
    }
  }

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="max-w-3xl space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{t('submitTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('submitHint')}</p>
        <p className="panel border-advisory-border bg-advisory p-3 text-sm">{t('anonymity')}</p>
      </header>
      {form.parts.map((part) => (
        <fieldset key={part.partType} className="panel space-y-4 p-5">
          <legend className="px-1 text-lg font-bold">{t(`parts.${part.partType}`)}</legend>
          <p className="text-sm text-muted-foreground">
            {t('partDeadline', {
              when: formatDateTime(
                locale,
                part.partType === 'legal_information'
                  ? form.deadlines.application
                  : part.partType === 'technical_offer'
                    ? form.deadlines.technical
                    : form.deadlines.financial,
              ),
            })}
          </p>
          <BidPartInputs
            part={part}
            draft={draft(part.partType)}
            onChange={(next) => {
              action.edited();
              setDrafts((all) => ({ ...all, [part.partType]: next }));
              setFailure(null);
            }}
            errors={errors[part.partType] ?? {}}
            disabled={busy}
          />
        </fieldset>
      ))}
      {failure && (
        <ErrorState title={t.has(`failures.${failure}`) ? t(`failures.${failure}`) : t('failed')} />
      )}
      <Button type="submit" disabled={busy || blocked}>
        {t(busy ? 'submitting' : 'submit')}
      </Button>
    </form>
  );
}
