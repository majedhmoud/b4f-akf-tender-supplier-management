'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState } from '@/components/layout/States';
import { SupplierCertificates } from '@/components/suppliers/SupplierCertificates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SupplierProfile } from '@/lib/api/generated/model';
import {
  useSupplierProfileGet,
  useSupplierProfileUpdate,
} from '@/lib/api/generated/suppliers/suppliers';
import { privateKey } from '@/lib/api/query-keys';
import { ApiError } from '@/lib/api/mutator';
import { useSession } from '@/lib/useSession';

type Field = 'legalName' | 'registrationNumber' | 'technicalInformation';
const FIELDS: { name: Field; maxLength: number; multiline?: boolean }[] = [
  { name: 'legalName', maxLength: 200 },
  { name: 'registrationNumber', maxLength: 100 },
  { name: 'technicalInformation', maxLength: 5000, multiline: true },
];

// P1–P3, shown inside My profile: the supplier's legal and technical information and certificates
// (API_CONTRACT.md, Suppliers). The API decides which fields are editable.
export function SupplierProfileForm() {
  const t = useTranslations('Suppliers');
  const { session } = useSession();
  const queryKey = privateKey(session?.user.id ?? '', ['supplier-profile']);
  const query = useSupplierProfileGet({
    query: { queryKey, enabled: !!session, retry: false },
  });

  if (query.isPending) return <Skeleton className="h-80" />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        title={t('loadFailed')}
        action={<Button onClick={() => void query.refetch()}>{t('retry')}</Button>}
      />
    );
  // Keyed by id so a refetched profile resets the form.
  return <ProfileEditor key={query.data.id} profile={query.data} queryKey={queryKey} />;
}

function ProfileEditor({
  profile,
  queryKey,
}: {
  profile: SupplierProfile;
  queryKey: readonly unknown[];
}) {
  const t = useTranslations('Suppliers');
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<Field, string>>({
    legalName: profile.legalName,
    registrationNumber: profile.registrationNumber,
    technicalInformation: profile.technicalInformation,
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const update = useSupplierProfileUpdate<ApiError>();
  const editable = new Set<string>(profile.editableFields);

  const changed = FIELDS.filter(
    ({ name }) => editable.has(name) && values[name] !== profile[name],
  ).map(({ name }) => name);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setFailed(false);
    setSaved(false);
    const missing = changed.filter(
      (name) => name !== 'technicalInformation' && !values[name].trim(),
    );
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((name) => [name, 'REQUIRED'])));
      return;
    }
    try {
      const next = await update.mutateAsync({
        data: Object.fromEntries(changed.map((name) => [name, values[name]])),
      });
      queryClient.setQueryData(queryKey, next);
      setValues({
        legalName: next.legalName,
        registrationNumber: next.registrationNumber,
        technicalInformation: next.technicalInformation,
      });
      setSaved(true);
    } catch (error) {
      const fields = error instanceof ApiError ? error.fields : [];
      if (fields.length)
        setErrors(Object.fromEntries(fields.map((f) => [f.field as Field, f.code])));
      else setFailed(true);
    }
  }

  return (
    <section className="max-w-3xl space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">{t('companyTitle')}</h2>
        <Badge variant={profile.status === 'active' ? 'secondary' : 'destructive'}>
          {t(`status.${profile.status}`)}
        </Badge>
      </header>
      {profile.status === 'suspended' && (
        <p role="status" className="panel border-advisory-border bg-advisory p-4 text-sm">
          {t('suspendedNotice')}
        </p>
      )}
      <form noValidate onSubmit={(e) => void save(e)} className="panel space-y-5 p-5">
        {FIELDS.map(({ name, maxLength, multiline }) => {
          const id = `supplier-${name}`;
          const error = errors[name];
          const props = {
            id,
            value: values[name],
            maxLength,
            disabled: !editable.has(name) || update.isPending,
            'aria-invalid': !!error,
            'aria-describedby': error ? `${id}-error` : undefined,
            dir: 'auto' as const,
            className: 'field-control',
          };
          return (
            <div key={name} className="space-y-2">
              <label htmlFor={id} className="block text-sm font-semibold">
                {t(`fields.${name}`)}
              </label>
              {multiline ? (
                <textarea
                  {...props}
                  rows={6}
                  onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                />
              ) : (
                <input
                  {...props}
                  onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                />
              )}
              {error && (
                <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
                  {t.has(`errors.${error}`) ? t(`errors.${error}`) : t('errors.INVALID')}
                </p>
              )}
            </div>
          );
        })}
        <p className="text-sm text-muted-foreground">{t('legalHint')}</p>
        {failed && <ErrorState title={t('saveFailed')} />}
        {saved && (
          <p role="status" className="text-sm font-semibold text-primary">
            {t('saved')}
          </p>
        )}
        <Button type="submit" disabled={!changed.length || update.isPending}>
          {t(update.isPending ? 'saving' : 'save')}
        </Button>
      </form>
      <SupplierCertificates profile={profile} queryKey={queryKey} />
    </section>
  );
}
