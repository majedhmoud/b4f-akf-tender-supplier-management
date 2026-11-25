'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import type { ManagedTender, TenderDocumentView } from '@/lib/api/generated/model';
import {
  useManageTendersDownload,
  useManageTendersUpload,
  useManageTendersRemoveDocument,
} from '@/lib/api/generated/tender-management/tender-management';
import { apiUrl } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { languageName } from '@/lib/format';
import { useSession } from '@/lib/useSession';
import {
  ManagementFeedback,
  ManagementField,
  managementControl,
  useManagementAction,
} from './ManagementFeedback';

export function ManagedDocument({
  tenderId,
  document,
  remove,
  disabled,
}: {
  tenderId: string;
  document: Pick<TenderDocumentView, 'id' | 'name' | 'language'>;
  remove?: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { session } = useSession();
  const client = useQueryClient();
  const [failed, setFailed] = useState(false);
  const key = privateKey(session?.user.id ?? '', [
    'manage-tenders',
    locale,
    'download',
    tenderId,
    document.id,
  ]);
  const download = useManageTendersDownload(tenderId, document.id, {
    query: { queryKey: key, enabled: false, retry: false, gcTime: 0 },
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
      <Button variant="outline" disabled={download.isFetching} onClick={() => void open()}>
        {t('Tender.download')}
      </Button>
      {remove && (
        <Button
          variant="outline"
          disabled={disabled}
          onClick={remove}
          aria-label={t('Manage.removeNamed', { name: document.name })}
        >
          {t('Manage.remove')}
        </Button>
      )}
      {failed && (
        <p role="alert" className="w-full text-sm text-destructive">
          {t('Tender.downloadFailed')}
        </p>
      )}
    </li>
  );
}
export function ManagedDocuments({
  tender,
  done,
  reload,
}: {
  tender: ManagedTender;
  done: () => Promise<void>;
  reload: () => Promise<void>;
}) {
  const t = useTranslations();
  const [base] = useState(tender);
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('en');
  const [translationOf, setTranslationOf] = useState('');
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const action = useManagementAction();
  const upload = useManageTendersUpload({ mutation: { retry: false } });
  const remove = useManageTendersRemoveDocument({ mutation: { retry: false } });
  const editable =
    base.status === 'accepted' && base.allowedActions.includes('upload_terms_of_reference');
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    await action.run(
      () =>
        upload.mutateAsync({
          tenderId: base.id,
          data: {
            revision: base.revision,
            kind: 'terms_of_reference',
            file,
            language,
            ...(translationOf ? { translationOf } : {}),
          },
        }),
      done,
    );
  }
  return (
    <section className="space-y-6 panel p-6">
      <h2 className="text-lg font-bold">{t('Tender.documents')}</h2>
      <ManagementFeedback error={action.error} reload={reload} />
      <ul>
        {base.documents
          .flatMap((original) => [original, ...original.translations])
          .map((document) => (
            <ManagedDocument
              key={document.id}
              tenderId={base.id}
              document={document}
              disabled={action.busy || action.locked}
              remove={editable ? () => setRemoveId(document.id) : undefined}
            />
          ))}
      </ul>
      {!base.documents.length && (
        <p className="text-sm text-muted-foreground">{t('Tender.noDocuments')}</p>
      )}
      {removeId && editable && (
        <div
          role="group"
          aria-label={t('Manage.removeConfirm')}
          className="space-y-3 rounded-md border border-destructive/30 p-4"
        >
          <p className="text-sm">{t('Manage.removeConfirm')}</p>
          <Button
            disabled={action.busy || action.locked}
            onClick={() =>
              void action.run(
                () =>
                  remove.mutateAsync({
                    tenderId: base.id,
                    docId: removeId,
                    params: { revision: base.revision },
                  }),
                done,
              )
            }
          >
            {t('Manage.confirmRemove')}
          </Button>
          <Button variant="outline" disabled={action.busy} onClick={() => setRemoveId(null)}>
            {t('Manage.cancel')}
          </Button>
        </div>
      )}
      {editable ? (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {invalid && <ErrorState title={t('Manage.fileRequired')} />}
          <fieldset disabled={action.busy || action.locked} className="grid gap-4 sm:grid-cols-2">
            <ManagementField label={t('Manage.file')}>
              <input
                className={managementControl}
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </ManagementField>
            <ManagementField label={t('Manage.documentLanguage')}>
              <select
                className={managementControl}
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option value="en">{t('Employee.en')}</option>
                <option value="ar">{t('Employee.ar')}</option>
              </select>
            </ManagementField>
            <ManagementField label={t('Manage.translationOf')} optional>
              <select
                className={managementControl}
                value={translationOf}
                onChange={(event) => setTranslationOf(event.target.value)}
              >
                <option value="">{t('Manage.originalDocument')}</option>
                {base.documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.name}
                  </option>
                ))}
              </select>
            </ManagementField>
            <div className="self-end">
              <Button type="submit" disabled={action.busy}>
                {t(action.busy ? 'Manage.saving' : 'Manage.upload')}
              </Button>
            </div>
          </fieldset>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">{t('Manage.readOnly')}</p>
      )}
    </section>
  );
}
