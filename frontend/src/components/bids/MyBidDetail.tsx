'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getMyBidsReplaceUrl,
  useMyBidsDetail,
  useMyBidsDownload,
  useTenderBidsForm,
} from '@/lib/api/generated/bids/bids';
import type {
  BidDocumentView,
  BidFormPart,
  BidPartView,
  SupplierBid,
} from '@/lib/api/generated/model';
import { ApiError, apiFetch, apiUrl } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { formatDateTime, languageName } from '@/lib/format';
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

// B3d, B4 and B6: one of the supplier's bids, with Replace per unlocked part.
export function MyBidDetail() {
  const t = useTranslations('Bids');
  const locale = useLocale();
  const { bidId } = useParams<{ bidId: string }>();
  const { session } = useSession();
  const key = privateKey(session?.user.id ?? '', ['bids', locale, 'detail', bidId]);
  const query = useMyBidsDetail(bidId, {
    query: { queryKey: key, enabled: !!session, retry: false },
  });
  const tenderId = query.data?.tender.id ?? '';
  const form = useTenderBidsForm(tenderId, {
    query: {
      queryKey: privateKey(session?.user.id ?? '', ['bid-form', locale, tenderId]),
      enabled: !!session && !!tenderId,
      retry: false,
    },
  });
  if (query.isPending) return <Skeleton className="h-80" />;
  if (query.isError || !query.data)
    return query.error instanceof ApiError && query.error.status === 404 ? (
      <EmptyState title={t('notFound')} />
    ) : (
      <ErrorState
        title={t('loadFailed')}
        action={<Button onClick={() => void query.refetch()}>{t('retry')}</Button>}
      />
    );
  const bid = query.data;
  return (
    <article className="max-w-3xl space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold" dir="auto" lang={bid.tender.content.language}>
          {bid.tender.content.title}
        </h1>
        <Badge variant="secondary">{t(`tenderStatus.${bid.tender.status}`)}</Badge>
        <p className="text-sm">
          {t('signatory')}: <span dir="auto">{bid.legalInformation.authorizedSignatoryName}</span>
        </p>
      </header>
      {form.isPending && <Skeleton className="h-16" />}
      {form.isError && (
        <ErrorState
          title={t('loadFailed')}
          action={<Button onClick={() => void form.refetch()}>{t('retry')}</Button>}
        />
      )}
      {bid.parts.map((part) => (
        <PartPanel
          key={part.partType}
          bid={bid}
          part={part}
          spec={
            form.isError ? undefined : form.data?.parts.find((p) => p.partType === part.partType)
          }
          detailKey={key}
        />
      ))}
    </article>
  );
}

function PartPanel({
  bid,
  part,
  spec,
  detailKey,
}: {
  bid: SupplierBid;
  part: BidPartView;
  spec: BidFormPart | undefined;
  detailKey: readonly unknown[];
}) {
  const t = useTranslations('Bids');
  const locale = useLocale();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PartDraft>(emptyDraft());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const action = useBidAction();
  const { busy, blocked } = action;
  const [saved, setSaved] = useState(false);

  function start() {
    action.edited();
    // Prefill the scalar values the supplier gave last time.
    const answers = Object.fromEntries(
      Object.entries(part.answers).map(([id, v]) => [
        id,
        typeof v === 'boolean' ? v : String(v ?? ''),
      ]),
    );
    setDraft({
      ...emptyDraft(),
      values:
        part.partType === 'legal_information'
          ? { authorizedSignatoryName: bid.legalInformation.authorizedSignatoryName }
          : {},
      answers,
    });
    setErrors({});
    setFailure(null);
    setSaved(false);
    setOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || blocked || !spec) return;
    setFailure(null);
    const local = draftErrors(spec, draft);
    if (Object.keys(local).length) return setErrors(local);
    setErrors({});
    const body = new FormData();
    if (part.partType === 'legal_information')
      body.append(
        'legalInformation',
        JSON.stringify(
          Object.fromEntries(Object.entries(draft.values).map(([k, v]) => [k, v.trim()])),
        ),
      );
    body.append('answers', JSON.stringify(draftAnswers(spec, draft)));
    for (const [name, file] of Object.entries(draft.files)) {
      if (!file) continue;
      body.append(`files[${name}]`, file);
      body.append(`languages[${name}]`, draft.languages[name] ?? '');
    }
    const requestKey = action.begin();
    if (!requestKey) return;
    let succeeded = false;
    try {
      await apiFetch(getMyBidsReplaceUrl(bid.id, part.partType), {
        method: 'PUT',
        body,
        headers: { 'Idempotency-Key': requestKey },
      });
      succeeded = true;
      setOpen(false);
      setSaved(true);
      await client.invalidateQueries({ queryKey: detailKey });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
      if (error instanceof ApiError && code === 'VALIDATION_FAILED')
        setErrors(serverErrors(error.fields, part.partType)[part.partType] ?? {});
      setFailure(code);
      action.failed(error);
    } finally {
      action.finish(succeeded);
    }
  }

  return (
    <section className="panel space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t(`parts.${part.partType}`)}</h2>
        <Badge variant={part.locked ? 'secondary' : 'default'}>
          {t(part.locked ? 'locked' : 'open')}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('partDeadline', { when: formatDateTime(locale, part.deadline) })} ·{' '}
        {t('lastSubmitted', { when: formatDateTime(locale, part.lastSubmittedAt) })}
      </p>
      <ul className="divide-y divide-border">
        {part.documents.map((doc) => (
          <DocumentRow key={doc.id} bidId={bid.id} doc={doc} spec={spec} />
        ))}
      </ul>
      {saved && (
        <p role="status" className="text-sm font-semibold text-primary">
          {t('replaced')}
        </p>
      )}
      {!open && part.allowedActions.includes('replace') && (
        <Button variant="outline" disabled={!spec} onClick={start}>
          {t('replace')}
        </Button>
      )}
      {open && spec && (
        <form
          noValidate
          onSubmit={(e) => void submit(e)}
          className="space-y-4 rounded-md border border-input p-4"
        >
          <p className="text-sm text-muted-foreground">{t('replaceHint')}</p>
          <BidPartInputs
            part={spec}
            draft={draft}
            onChange={(next) => {
              action.edited();
              setDraft(next);
              setFailure(null);
            }}
            errors={errors}
            disabled={busy}
          />
          {failure && (
            <ErrorState
              title={t.has(`failures.${failure}`) ? t(`failures.${failure}`) : t('failed')}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || blocked}>
              {t(busy ? 'submitting' : 'saveReplacement')}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function DocumentRow({
  bidId,
  doc,
  spec,
}: {
  bidId: string;
  doc: BidDocumentView;
  spec: BidFormPart | undefined;
}) {
  const t = useTranslations('Bids');
  const locale = useLocale();
  const client = useQueryClient();
  const { session } = useSession();
  const [failed, setFailed] = useState(false);
  const key = privateKey(session?.user.id ?? '', ['bid-document', doc.id]);
  const download = useMyBidsDownload(bidId, doc.id, {
    query: { queryKey: key, enabled: false, retry: false, gcTime: 0 },
  });
  const label = doc.kind
    ? t(`documents.${doc.kind}`)
    : (spec?.customFields.find((f) => f.fieldId === doc.fieldId)?.label ?? t('customFile'));

  async function open() {
    setFailed(false);
    try {
      const result = await download.refetch();
      if (result.error || !result.data) setFailed(true);
      else window.location.assign(apiUrl(result.data.url));
    } catch {
      setFailed(true);
    } finally {
      client.removeQueries({ queryKey: key, exact: true });
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-sm break-words" dir="auto">
          {doc.name}
        </p>
        <p className="text-xs text-muted-foreground">{languageName(locale, doc.language)}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={download.isFetching}
        onClick={() => void open()}
      >
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
