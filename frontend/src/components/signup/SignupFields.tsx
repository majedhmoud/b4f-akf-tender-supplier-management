'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FieldLabel } from '@/components/ui/field-label';
import type { LegalApplicationView } from '@/lib/api/generated/model';
import { formatDateTime, languageName } from '@/lib/format';

export const signupControl = 'field-control';
export function SignupField({
  label,
  error,
  optional = false,
  children,
}: {
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-sm">
      <span className="field-label">
        <FieldLabel optional={optional}>{label}</FieldLabel>
      </span>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}
export function SignupApplicationFields({
  application,
}: {
  application: Omit<LegalApplicationView, 'documents'>;
}) {
  const t = useTranslations('Signup');
  const locale = useLocale();
  return (
    <dl className="grid gap-5 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">{t('legalName')}</dt>
        <dd className="mt-1 break-words" dir="auto">
          {application.legalName}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('registrationNumber')}</dt>
        <dd className="mt-1 break-words" dir="auto">
          {application.registrationNumber}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('contactEmail')}</dt>
        <dd className="mt-1 break-all">
          <bdi>{application.contactEmail}</bdi>
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('preferredLanguage')}</dt>
        <dd className="mt-1">{languageName(locale, application.preferredLanguage)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('submittedAt')}</dt>
        <dd className="mt-1">
          <time dateTime={application.submittedAt}>
            {formatDateTime(locale, application.submittedAt)}
          </time>
        </dd>
      </div>
    </dl>
  );
}
