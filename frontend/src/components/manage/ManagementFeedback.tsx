'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/mutator';

// A stale revision preserves inputs; a changed status stops further writes (§1.4).
export function useManagementAction() {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  async function run(action: () => Promise<unknown>, done: () => Promise<void>) {
    if (busy || locked) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      await done();
    } catch (failure) {
      setError(failure);
      if (
        failure instanceof ApiError &&
        ['TENDER_STATUS_CHANGED', 'NOT_FOUND'].includes(failure.code)
      )
        setLocked(true);
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, locked, run };
}

export function ManagementFeedback({
  error,
  reload,
}: {
  error: unknown;
  reload: () => Promise<void>;
}) {
  const t = useTranslations('Manage');
  if (!error) return null;
  const code = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
  const labels: Record<string, string> = {
    VERSION_CONFLICT: 'conflict',
    TENDER_STATUS_CHANGED: 'statusChanged',
    NOT_FOUND: 'notFound',
    VALIDATION_FAILED: 'invalid',
    TENDER_ALREADY_COPIED: 'alreadyCopied',
    TENDER_NOT_CANCELLED: 'notCancelled',
    FILE_TOO_LARGE: 'fileTooLarge',
    FILE_TYPE_NOT_ALLOWED: 'fileType',
  };
  const fields = error instanceof ApiError ? error.fields : [];
  const fieldLabels: Record<string, string> = {
    WEIGHTS_MUST_SUM_TO_100: 'weightsInvalid',
    ALREADY_UPLOADED: 'fileAlreadyUploaded',
    TRANSLATION_SAME_LANGUAGE: 'translationLanguage',
    DEADLINES_OUT_OF_ORDER: 'deadlineOrder',
    DEADLINE_IN_PAST: 'deadlinePast',
  };
  return (
    <div className="space-y-3">
      <ErrorState
        title={t(labels[code] ?? 'failed')}
        action={
          ['VERSION_CONFLICT', 'TENDER_STATUS_CHANGED', 'NOT_FOUND'].includes(code) ? (
            <Button type="button" variant="outline" onClick={() => void reload()}>
              {t('reload')}
            </Button>
          ) : undefined
        }
      />
      {fields.length > 0 && (
        <ul
          className="list-inside list-disc text-sm text-destructive"
          aria-label={t('fieldErrors')}
        >
          {fields.map((field, index) => (
            <li key={index}>{t(fieldLabels[field.code] ?? 'invalidField')}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const managementControl = 'field-control';
export function ManagementField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-sm">
      <span>{label}</span>
      {children}
    </label>
  );
}
