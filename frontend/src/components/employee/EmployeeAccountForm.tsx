'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useAdminEmployeesCreate } from '@/lib/api/generated/employee-accounts/employee-accounts';
import { ApiError } from '@/lib/api/mutator';

const inputStyle = 'min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm';

export function EmployeeAccountForm() {
  const t = useTranslations('EmployeeAccounts');
  const locale = useLocale();
  const { mutateAsync, isPending } = useAdminEmployeesCreate<ApiError>();
  const [createdEmail, setCreatedEmail] = useState('');
  const [error, setError] = useState<'duplicate' | 'failure' | ''>('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setError('');
    setCreatedEmail('');
    try {
      const created = await mutateAsync({
        data: {
          displayName: String(fields.get('displayName') ?? '').trim(),
          email: String(fields.get('email') ?? '').trim(),
          preferredLanguage: fields.get('preferredLanguage') === 'ar' ? 'ar' : 'en',
        },
      });
      form.reset();
      setCreatedEmail(created.email);
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.code === 'EMAIL_ALREADY_REGISTERED'
          ? 'duplicate'
          : 'failure',
      );
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </header>
      <form onSubmit={submit} className="panel space-y-5 p-5 sm:p-6">
        <fieldset disabled={isPending} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="employee-name" className="block text-sm font-medium">
              {t('name')}
            </label>
            <input
              id="employee-name"
              name="displayName"
              autoComplete="off"
              required
              maxLength={120}
              pattern=".*\S.*"
              className={inputStyle}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="employee-email" className="block text-sm font-medium">
              {t('email')}
            </label>
            <input
              id="employee-email"
              name="email"
              type="email"
              dir="ltr"
              autoComplete="off"
              required
              maxLength={254}
              className={inputStyle}
              aria-invalid={error === 'duplicate'}
              aria-describedby={error === 'duplicate' ? 'employee-error' : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="employee-language" className="block text-sm font-medium">
              {t('language')}
            </label>
            <select
              id="employee-language"
              name="preferredLanguage"
              defaultValue={locale}
              className={inputStyle}
            >
              <option value="en" lang="en">
                English
              </option>
              <option value="ar" lang="ar">
                العربية
              </option>
            </select>
          </div>
          <Button type="submit" disabled={isPending}>
            {t(isPending ? 'creating' : 'create')}
          </Button>
        </fieldset>
        {error && (
          <p id="employee-error" role="alert" className="text-sm text-destructive">
            {t(error)}
          </p>
        )}
        {createdEmail && (
          <p role="status" className="break-words text-sm">
            {t('created', { email: createdEmail })}
          </p>
        )}
      </form>
    </section>
  );
}
