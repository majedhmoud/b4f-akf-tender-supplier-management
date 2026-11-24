'use client';

import { useTranslations } from 'next-intl';
import { FieldLabel } from '@/components/ui/field-label';
import type { BidFormPart } from '@/lib/api/generated/model';

// What the supplier has entered for one part, keyed like the API's fields.
export interface PartDraft {
  values: Record<string, string>;
  answers: Record<string, string | boolean>;
  files: Record<string, File | undefined>;
  languages: Record<string, string>;
}

export const emptyDraft = (): PartDraft => ({ values: {}, answers: {}, files: {}, languages: {} });

const ACCEPT = '.pdf,.docx,.xlsx,.png,.jpg,.jpeg';

// Client checks that mirror the API's, so obvious gaps show before upload.
export function draftErrors(part: BidFormPart, draft: PartDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of part.fields)
    if (field.required && !draft.values[field.name]?.trim()) errors[field.name] = 'REQUIRED';
  const fileKeys = [
    ...part.documents.map((d) => ({ key: d.kind, required: d.required })),
    ...part.customFields
      .filter((f) => f.type === 'file')
      .map((f) => ({ key: f.fieldId, required: f.required })),
  ];
  for (const { key, required } of fileKeys) {
    if (!draft.files[key]) {
      if (required) errors[`file:${key}`] = 'REQUIRED';
    } else if (!/^[a-z]{2}$/.test(draft.languages[key] ?? ''))
      errors[`language:${key}`] = 'INVALID';
  }
  for (const field of part.customFields) {
    if (field.type === 'file' || field.type === 'boolean') continue;
    const value = draft.answers[field.fieldId];
    if (value === undefined || (typeof value === 'string' && !value.trim())) {
      if (field.required) errors[field.fieldId] = 'REQUIRED';
    } else if (field.type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) errors[field.fieldId] = 'INVALID';
      else if (field.minimum !== null && n < field.minimum) errors[field.fieldId] = 'BELOW_MINIMUM';
    }
  }
  return errors;
}

// The custom answers in the API's JSON form.
export function draftAnswers(part: BidFormPart, draft: PartDraft) {
  const answers: Record<string, string | number | boolean> = {};
  for (const field of part.customFields) {
    if (field.type === 'file') continue;
    const value = draft.answers[field.fieldId];
    if (field.type === 'boolean') answers[field.fieldId] = value === true;
    else if (value !== undefined && value !== '')
      answers[field.fieldId] = field.type === 'number' ? Number(value) : String(value).trim();
  }
  return answers;
}

export function BidPartInputs({
  part,
  draft,
  onChange,
  errors,
  disabled,
}: {
  part: BidFormPart;
  draft: PartDraft;
  onChange: (draft: PartDraft) => void;
  errors: Record<string, string>;
  disabled: boolean;
}) {
  const t = useTranslations('Bids');
  const id = (key: string) => `${part.partType}-${key}`;
  const error = (key: string) =>
    errors[key] ? (
      <p role="alert" className="text-sm text-destructive">
        {t.has(`errors.${errors[key]}`) ? t(`errors.${errors[key]}`) : t('errors.INVALID')}
      </p>
    ) : null;
  const fileInput = (key: string, label: string, required: boolean) => (
    <div key={key} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
      <div className="space-y-1">
        <label htmlFor={id(`file-${key}`)} className="field-label">
          <FieldLabel optional={!required}>{label}</FieldLabel>
        </label>
        <input
          id={id(`file-${key}`)}
          type="file"
          accept={ACCEPT}
          disabled={disabled}
          aria-required={required}
          aria-invalid={!!errors[`file:${key}`]}
          onChange={(e) =>
            onChange({ ...draft, files: { ...draft.files, [key]: e.target.files?.[0] } })
          }
          className="field-control"
        />
        {error(`file:${key}`)}
      </div>
      <div className="space-y-1">
        <label htmlFor={id(`language-${key}`)} className="field-label">
          <FieldLabel optional>{t('fileLanguage')}</FieldLabel>
        </label>
        <input
          id={id(`language-${key}`)}
          dir="ltr"
          maxLength={2}
          disabled={disabled}
          value={draft.languages[key] ?? ''}
          aria-invalid={!!errors[`language:${key}`]}
          onChange={(e) =>
            onChange({
              ...draft,
              languages: { ...draft.languages, [key]: e.target.value.toLowerCase() },
            })
          }
          className="field-control"
        />
        {error(`language:${key}`)}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {part.fields.map((field) => (
        <div key={field.name} className="space-y-1">
          <label htmlFor={id(field.name)} className="field-label">
            <FieldLabel optional={!field.required}>{t(`standardFields.${field.name}`)}</FieldLabel>
          </label>
          <input
            id={id(field.name)}
            dir="auto"
            maxLength={field.maxLength}
            disabled={disabled}
            aria-required={field.required}
            value={draft.values[field.name] ?? ''}
            aria-invalid={!!errors[field.name]}
            onChange={(e) =>
              onChange({ ...draft, values: { ...draft.values, [field.name]: e.target.value } })
            }
            className="field-control"
          />
          {error(field.name)}
        </div>
      ))}
      {part.documents.map((doc) => fileInput(doc.kind, t(`documents.${doc.kind}`), doc.required))}
      {part.customFields.map((field) => {
        const label = `${field.label}${field.unit ? ` (${field.unit})` : ''}`;
        if (field.type === 'file') return fileInput(field.fieldId, label, field.required);
        return (
          <div key={field.fieldId} className="space-y-1" lang={field.language}>
            {field.type === 'boolean' ? (
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  disabled={disabled}
                  aria-required={field.required}
                  checked={draft.answers[field.fieldId] === true}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      answers: { ...draft.answers, [field.fieldId]: e.target.checked },
                    })
                  }
                  className="size-4 accent-primary"
                />
                <FieldLabel optional={!field.required}>{label}</FieldLabel>
              </label>
            ) : (
              <>
                <label htmlFor={id(field.fieldId)} className="field-label">
                  <FieldLabel optional={!field.required}>{label}</FieldLabel>
                </label>
                <input
                  id={id(field.fieldId)}
                  type={field.type === 'number' ? 'number' : 'text'}
                  min={field.minimum ?? undefined}
                  dir="auto"
                  maxLength={field.type === 'text' ? 2000 : undefined}
                  disabled={disabled}
                  aria-required={field.required}
                  value={String(draft.answers[field.fieldId] ?? '')}
                  aria-invalid={!!errors[field.fieldId]}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      answers: { ...draft.answers, [field.fieldId]: e.target.value },
                    })
                  }
                  className="field-control"
                />
              </>
            )}
            {field.instructions && (
              <p className="text-sm text-muted-foreground">{field.instructions}</p>
            )}
            {error(field.fieldId)}
          </div>
        );
      })}
    </div>
  );
}
