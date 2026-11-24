'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SupplierCertificate, SupplierProfile } from '@/lib/api/generated/model';
import {
  useSupplierProfileDownload,
  useSupplierProfileReplaceDocument,
} from '@/lib/api/generated/suppliers/suppliers';
import { apiUrl, ApiError } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { formatDateTime, languageName } from '@/lib/format';
import { useSession } from '@/lib/useSession';

// The sign-up certificates on the supplier's profile (API_CONTRACT.md,
// Suppliers, P3). Replacing one keeps the reviewed original on the application.
export function SupplierCertificates({
  profile,
  queryKey,
}: {
  profile: SupplierProfile;
  queryKey: readonly unknown[];
}) {
  const t = useTranslations('Suppliers');
  return (
    <section className="panel space-y-3 p-5">
      <h2 className="text-lg font-bold">{t('certificatesTitle')}</h2>
      <p className="text-sm text-muted-foreground">{t('certificatesHint')}</p>
      <ul>
        {profile.certificates.map((certificate) => (
          <CertificateRow key={certificate.kind} certificate={certificate} queryKey={queryKey} />
        ))}
      </ul>
    </section>
  );
}

function CertificateRow({
  certificate,
  queryKey,
}: {
  certificate: SupplierCertificate;
  queryKey: readonly unknown[];
}) {
  const t = useTranslations('Suppliers');
  const locale = useLocale();
  const { session } = useSession();
  const client = useQueryClient();
  const [replacing, setReplacing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState(certificate.language);
  const [error, setError] = useState<string | null>(null);
  const [replaced, setReplaced] = useState(false);
  const downloadKey = privateKey(session?.user.id ?? '', ['supplier-document', certificate.id]);
  const download = useSupplierProfileDownload(certificate.id, {
    query: { queryKey: downloadKey, enabled: false, retry: false, gcTime: 0 },
  });
  const replace = useSupplierProfileReplaceDocument<ApiError>();
  const id = `certificate-${certificate.kind}`;

  async function open() {
    setError(null);
    try {
      const result = await download.refetch();
      if (result.error || !result.data) setError('downloadFailed');
      else window.location.assign(apiUrl(result.data.url));
    } catch {
      setError('downloadFailed');
    } finally {
      client.removeQueries({ queryKey: downloadKey, exact: true });
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!file) return setError('fileRequired');
    if (!/^[a-z]{2}$/.test(language)) return setError('languageInvalid');
    try {
      const next = await replace.mutateAsync({
        data: { kind: certificate.kind, language, file },
      });
      client.setQueryData(queryKey, next);
      setReplacing(false);
      setFile(null);
      setReplaced(true);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setError(
        code === 'FILE_TOO_LARGE'
          ? 'fileTooLarge'
          : code.startsWith('FILE_')
            ? 'fileType'
            : 'replaceFailed',
      );
    }
  }

  return (
    <li className="space-y-3 border-b border-border py-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {t(`kinds.${certificate.kind}`)}
            <Badge variant={certificate.source === 'updated' ? 'default' : 'secondary'}>
              {t(`source.${certificate.source}`)}
            </Badge>
          </p>
          <p className="text-sm break-words" dir="auto">
            {certificate.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {languageName(locale, certificate.language)} ·{' '}
            <time dateTime={certificate.uploadedAt}>
              {formatDateTime(locale, certificate.uploadedAt)}
            </time>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={download.isFetching} onClick={() => void open()}>
            {t('download')}
          </Button>
          {!replacing && (
            <Button
              variant="outline"
              onClick={() => {
                setFile(null);
                setLanguage(certificate.language);
                setReplacing(true);
                setReplaced(false);
                setError(null);
              }}
            >
              {t('replace')}
            </Button>
          )}
        </div>
      </div>
      {replaced && (
        <p role="status" className="text-sm font-semibold text-primary">
          {t('replaced')}
        </p>
      )}
      {replacing && (
        <form
          noValidate
          onSubmit={(e) => void submit(e)}
          className="grid gap-3 rounded-md border border-input p-4 sm:grid-cols-[minmax(0,1fr)_7rem]"
        >
          <div className="space-y-2">
            <label htmlFor={`${id}-file`} className="block text-sm font-semibold">
              {t('newFile')}
            </label>
            <input
              id={`${id}-file`}
              type="file"
              accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
              disabled={replace.isPending}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="field-control"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor={`${id}-language`} className="block text-sm font-semibold">
              {t('fileLanguage')}
            </label>
            <input
              id={`${id}-language`}
              dir="ltr"
              maxLength={2}
              value={language}
              disabled={replace.isPending}
              onChange={(e) => setLanguage(e.target.value.toLowerCase())}
              className="field-control"
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={replace.isPending}>
              {t(replace.isPending ? 'uploading' : 'upload')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={replace.isPending}
              onClick={() => {
                setFile(null);
                setLanguage(certificate.language);
                setReplacing(false);
                setError(null);
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`fileErrors.${error}`)}
        </p>
      )}
    </li>
  );
}
