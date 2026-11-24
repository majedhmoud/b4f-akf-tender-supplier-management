'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { useSignupFormForm } from '@/lib/api/generated/reference/reference';
import { useSupplierApplicationsSubmit } from '@/lib/api/generated/sign-up/sign-up';
import type { SupplierApplicationsSubmitBody } from '@/lib/api/generated/model';
import { ApiError } from '@/lib/api/mutator';
import { publicKey } from '@/lib/api/query-keys';
import { useSession } from '@/lib/useSession';
import { SignupField, signupControl } from './SignupFields';

const kinds = ['registration_certificate', 'tax_certificate'] as const;
const names = ['legalName', 'registrationNumber', 'contactEmail', 'preferredLanguage'] as const;
type Kind = (typeof kinds)[number];
export function SupplierApplicationForm() {
  const t = useTranslations('Signup');
  const locale = useLocale();
  const { session, isLoading, error: sessionError, retry: retrySession } = useSession();
  const spec = useSignupFormForm({
    query: { queryKey: publicKey(locale, ['supplier-application-form']), retry: false },
  });
  const [headers] = useState(() => new Headers());
  const key = useRef<string | null>(null);
  const mutation = useSupplierApplicationsSubmit<ApiError>({
    request: { headers },
    mutation: { retry: false, gcTime: 0 },
  });
  const [values, setValues] = useState({
    legalName: '',
    registrationNumber: '',
    contactEmail: '',
    preferredLanguage: locale === 'ar' ? 'ar' : 'en',
  });
  const [files, setFiles] = useState<Partial<Record<Kind, File>>>({});
  const [languages, setLanguages] = useState<Record<Kind, string>>({
    registration_certificate: locale,
    tax_certificate: locale,
  });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [waitMs, setWaitMs] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!waitMs) return;
    const timeout = setTimeout(() => setWaitMs(0), waitMs);
    return () => clearTimeout(timeout);
  }, [waitMs]);
  function change() {
    key.current = null;
    setFailure(null);
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending || waitMs || session || !spec.data) return;
    const invalid: Record<string, string> = {};
    for (const field of spec.data.fields) {
      const value = values[field.name as keyof typeof values]?.trim();
      if (field.required && !value) invalid[field.name] = t('required');
      if (value && field.maxLength && value.length > field.maxLength)
        invalid[field.name] = t('invalidField');
    }
    if (values.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim()))
      invalid.contactEmail = t('invalidEmail');
    for (const kind of kinds) {
      const file = files[kind];
      if (!file && spec.data.documents.find((document) => document.kind === kind)?.required)
        invalid[`files[${kind}]`] = t('required');
      if (
        file &&
        (file.size > 20 * 1024 * 1024 ||
          file.size === 0 ||
          !/\.(pdf|docx|xlsx|png|jpe?g)$/i.test(file.name))
      )
        invalid[`files[${kind}]`] = t('fileInvalid');
      if (!/^[a-z]{2}$/.test(languages[kind])) invalid[`languages[${kind}]`] = t('invalidLanguage');
    }
    setFields(invalid);
    setFailure(null);
    if (Object.keys(invalid).length) return;
    // One key per deliberate action, retained across network/CSRF retries (§1.3).
    key.current ??= crypto.randomUUID();
    headers.set('Idempotency-Key', key.current);
    const data: SupplierApplicationsSubmitBody = {
      application: JSON.stringify({
        ...values,
        legalName: values.legalName.trim(),
        registrationNumber: values.registrationNumber.trim(),
        contactEmail: values.contactEmail.trim(),
      }),
      'files[registration_certificate]': files.registration_certificate!,
      'languages[registration_certificate]': languages.registration_certificate,
      'files[tax_certificate]': files.tax_certificate!,
      'languages[tax_certificate]': languages.tax_certificate,
    };
    try {
      await mutation.mutateAsync({ data });
      setSubmitted(true);
      setFiles({});
      mutation.reset();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
      setFailure(code);
      if (code === 'IDEMPOTENCY_IN_PROGRESS') setWaitMs(1000);
      if (code === 'RATE_LIMITED')
        setWaitMs(error instanceof ApiError ? error.retryAfterMs : 60_000);
      const inline: Record<string, string> = {};
      if (code === 'EMAIL_ALREADY_REGISTERED') inline.contactEmail = t('emailRegistered');
      if (code === 'REGISTRATION_NUMBER_EXISTS')
        inline.registrationNumber = t('registrationExists');
      if (error instanceof ApiError && code === 'VALIDATION_FAILED')
        for (const field of error.fields)
          inline[field.field.replace(/^application\./, '')] = t('invalidField');
      if (code === 'FILE_TOO_LARGE' || code === 'FILE_TYPE_NOT_ALLOWED')
        for (const kind of kinds) inline[`files[${kind}]`] = t('fileInvalid');
      setFields(inline);
    }
  }
  if (isLoading || spec.isPending) return <Skeleton className="h-64" />;
  if (sessionError)
    return (
      <ErrorState
        title={t('sessionFailed')}
        action={<Button onClick={retrySession}>{t('retry')}</Button>}
      />
    );
  if (session) return <EmptyState title={t('guestOnly')} hint={t('guestOnlyHint')} />;
  if (submitted)
    return (
      <div role="status">
        <EmptyState title={t('submitted')} hint={t('submittedHint')} />
        <Link href="/tenders" className="mt-4 inline-block text-primary hover:underline">
          {t('backTenders')}
        </Link>
      </div>
    );
  if (spec.isError)
    return (
      <ErrorState
        title={t('formFailed')}
        action={<Button onClick={() => void spec.refetch()}>{t('retry')}</Button>}
      />
    );
  // Fail visibly if a future form spec introduces unsupported required inputs.
  if (
    spec.data.fields.some((field) => !names.includes(field.name as (typeof names)[number])) ||
    spec.data.documents.some((document) => !kinds.includes(document.kind as Kind))
  )
    return <ErrorState title={t('formFailed')} />;
  const errors: Record<string, string> = {
    EMAIL_ALREADY_REGISTERED: 'emailRegistered',
    REGISTRATION_NUMBER_EXISTS: 'registrationExists',
    IDEMPOTENCY_IN_PROGRESS: 'inProgress',
    IDEMPOTENCY_KEY_REUSED: 'keyReused',
    VALIDATION_FAILED: 'invalid',
    FILE_TOO_LARGE: 'fileInvalid',
    FILE_TYPE_NOT_ALLOWED: 'fileInvalid',
    RATE_LIMITED: 'rateLimited',
    NOT_FOUND: 'guestOnly',
  };
  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{t('apply')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('applicationHint')}</p>
      </header>
      {failure && (
        <ErrorState
          title={t(errors[failure] ?? 'submitFailed')}
          action={
            failure === 'EMAIL_ALREADY_REGISTERED' ? (
              <Link href="/sign-in" className="font-medium underline underline-offset-4">
                {t('signInInstead')}
              </Link>
            ) : undefined
          }
        />
      )}

      <fieldset disabled={mutation.isPending} className="space-y-5">
        <section className="grid gap-5 panel p-5 sm:grid-cols-2">
          {spec.data.fields.map((field) => (
            <SignupField key={field.name} label={t(field.name)} error={fields[field.name]}>
              {field.name === 'preferredLanguage' ? (
                <select
                  className={signupControl}
                  value={values.preferredLanguage}
                  onChange={(event) => {
                    change();
                    setValues((v) => ({ ...v, preferredLanguage: event.target.value }));
                  }}
                >
                  <option value="en">{t('en')}</option>
                  <option value="ar">{t('ar')}</option>
                </select>
              ) : (
                <input
                  className={signupControl}
                  dir={field.type === 'email' ? 'ltr' : 'auto'}
                  type={field.type === 'email' ? 'email' : 'text'}
                  autoComplete={
                    field.name === 'contactEmail'
                      ? 'email'
                      : field.name === 'legalName'
                        ? 'organization'
                        : 'off'
                  }
                  maxLength={field.maxLength}
                  required={field.required}
                  aria-invalid={!!fields[field.name]}
                  value={values[field.name as keyof typeof values]}
                  onChange={(event) => {
                    change();
                    setValues((v) => ({ ...v, [field.name]: event.target.value }));
                  }}
                />
              )}
            </SignupField>
          ))}
        </section>
        <section className="space-y-5 panel p-5">
          <h2 className="font-bold">{t('documents')}</h2>
          <p className="text-xs text-muted-foreground">{t('filesHint')}</p>
          {spec.data.documents.map((document) => {
            const kind = document.kind as Kind;
            return (
              <div key={kind} className="grid gap-4 sm:grid-cols-2">
                <SignupField label={t(kind)} error={fields[`files[${kind}]`]}>
                  <input
                    className={signupControl}
                    type="file"
                    accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                    required={document.required}
                    aria-invalid={!!fields[`files[${kind}]`]}
                    onChange={(event) => {
                      change();
                      setFiles((current) => ({ ...current, [kind]: event.target.files?.[0] }));
                    }}
                  />
                </SignupField>
                <SignupField
                  label={t('fileLanguage', { document: t(kind) })}
                  error={fields[`languages[${kind}]`]}
                >
                  <input
                    className={signupControl}
                    dir="ltr"
                    value={languages[kind]}
                    maxLength={2}
                    aria-invalid={!!fields[`languages[${kind}]`]}
                    onChange={(event) => {
                      change();
                      setLanguages((v) => ({ ...v, [kind]: event.target.value.toLowerCase() }));
                    }}
                  />
                </SignupField>
              </div>
            );
          })}
        </section>
        <Button type="submit" disabled={mutation.isPending || !!waitMs}>
          {t(mutation.isPending ? 'submitting' : waitMs ? 'pleaseWait' : 'submit')}
        </Button>
      </fieldset>
    </form>
  );
}
