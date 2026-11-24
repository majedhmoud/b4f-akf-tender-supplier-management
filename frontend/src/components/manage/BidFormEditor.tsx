'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  BidFormEditorView,
  CustomFieldDto,
  FormInputType,
  PartType,
} from '@/lib/api/generated/model';
import {
  useManageTendersGetBidForm,
  useManageTendersSaveBidForm,
} from '@/lib/api/generated/tender-management/tender-management';
import { ApiError } from '@/lib/api/mutator';
import { privateKey } from '@/lib/api/query-keys';
import { useSession } from '@/lib/useSession';
import {
  ManagementFeedback,
  ManagementField,
  managementControl,
  useManagementAction,
} from './ManagementFeedback';
import { BackLink } from '@/components/ui/back-link';

type EditableField = {
  key: string;
  fieldId?: string;
  type: FormInputType;
  required: boolean;
  unit: string;
  minimum: string;
  en: { label: string; instructions: string };
  ar: { label: string; instructions: string };
};
const types: FormInputType[] = ['text', 'number', 'boolean', 'file'];
function initialFields(view: BidFormEditorView): { partType: PartType; fields: EditableField[] }[] {
  return view.parts.map((part) => ({
    partType: part.partType,
    fields: part.customFields.map((field) => ({
      key: field.fieldId,
      fieldId: field.fieldId,
      type: field.type,
      required: field.required,
      unit: field.unit ?? '',
      minimum: field.minimum?.toString() ?? '',
      en: {
        label: field.translations.find((row) => row.language === 'en')?.label ?? '',
        instructions: field.translations.find((row) => row.language === 'en')?.instructions ?? '',
      },
      ar: {
        label: field.translations.find((row) => row.language === 'ar')?.label ?? '',
        instructions: field.translations.find((row) => row.language === 'ar')?.instructions ?? '',
      },
    })),
  }));
}
export function BidFormFields({
  tenderId,
  view,
  done,
  reload,
}: {
  tenderId: string;
  view: BidFormEditorView;
  done: () => Promise<void>;
  reload: () => Promise<void>;
}) {
  const t = useTranslations('Manage');
  const [base] = useState(view);
  const [parts, setParts] = useState(initialFields(view));
  const [invalid, setInvalid] = useState(false);
  const action = useManagementAction();
  const save = useManageTendersSaveBidForm({ mutation: { retry: false } });
  const editable = base.allowedActions.includes('save');
  function change(partType: PartType, key: string, change: Partial<EditableField>) {
    setParts((current) =>
      current.map((part) =>
        part.partType !== partType
          ? part
          : {
              ...part,
              fields: part.fields.map((field) =>
                field.key === key ? { ...field, ...change } : field,
              ),
            },
      ),
    );
  }
  function move(partType: PartType, index: number, delta: number) {
    setParts((current) =>
      current.map((part) => {
        if (part.partType !== partType) return part;
        const fields = [...part.fields];
        [fields[index], fields[index + delta]] = [fields[index + delta], fields[index]];
        return { ...part, fields };
      }),
    );
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    let valid = true;
    const payload = parts.map((part) => ({
      partType: part.partType,
      customFields: part.fields.map((field): CustomFieldDto => {
        const translations = (['en', 'ar'] as const)
          .filter((lang) => field[lang].label.trim() || field[lang].instructions.trim())
          .map((language) => ({
            language,
            label: field[language].label.trim(),
            instructions: field[language].instructions.trim(),
          }));
        if (
          !translations.length ||
          translations.some((row) => !row.label) ||
          (field.type === 'number' &&
            field.minimum.trim() !== '' &&
            !Number.isFinite(Number(field.minimum)))
        )
          valid = false;
        return {
          ...(field.fieldId ? { fieldId: field.fieldId } : {}),
          type: field.type,
          required: field.required,
          translations,
          ...(field.type === 'number' && field.unit.trim() ? { unit: field.unit.trim() } : {}),
          ...(field.type === 'number' && field.minimum.trim() !== ''
            ? { minimum: Number(field.minimum) }
            : {}),
        };
      }),
    }));
    setInvalid(!valid);
    if (!valid) return;
    await action.run(
      () => save.mutateAsync({ tenderId, data: { revision: base.revision, parts: payload } }),
      done,
    );
  }
  const standardLabels: Record<string, string> = {
    authorizedSignatoryName: 'standardSignatory',
    registration_certificate: 'standardRegistration',
    technical_proposal: 'standardTechnical',
    financial_proposal: 'standardFinancial',
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <p className="rounded-md bg-secondary p-4 text-sm">{t('formHint')}</p>
      <ManagementFeedback error={action.error} reload={reload} />
      {invalid && <ErrorState title={t('fieldInvalid')} />}
      {!editable && <p role="status">{t('readOnly')}</p>}
      {parts.map((part) => (
        <section key={part.partType} className="space-y-4 panel p-5">
          <h2 className="text-lg font-bold">{t(`part_${part.partType}`)}</h2>
          <div className="rounded-md bg-secondary/50 p-4">
            <h3 className="mb-2 text-sm font-semibold">{t('standardInputs')}</h3>
            <ul className="space-y-2 text-sm">
              {base.parts
                .find((row) => row.partType === part.partType)
                ?.fields.map((field) => (
                  <li key={field.name}>
                    {standardLabels[field.name] ? t(standardLabels[field.name]) : field.name} ·{' '}
                    {t(field.required ? 'required' : 'optional')}
                  </li>
                ))}
              {base.parts
                .find((row) => row.partType === part.partType)
                ?.documents.map((file) => (
                  <li key={file.kind}>
                    {standardLabels[file.kind] ? t(standardLabels[file.kind]) : file.kind} ·{' '}
                    {t(file.required ? 'required' : 'optional')}
                  </li>
                ))}
            </ul>
          </div>
          <fieldset disabled={!editable || action.busy || action.locked} className="space-y-4">
            {part.fields.map((field, index) => (
              <fieldset key={field.key} className="space-y-4 rounded-md border p-4">
                <legend className="px-2 text-sm font-semibold">
                  {t('fieldNumber', { number: index + 1 })}
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ManagementField label={t('fieldType')}>
                    <select
                      className={managementControl}
                      value={field.type}
                      onChange={(event) =>
                        change(part.partType, field.key, {
                          type: event.target.value as FormInputType,
                        })
                      }
                    >
                      {types.map((type) => (
                        <option key={type} value={type}>
                          {t(`type_${type}`)}
                        </option>
                      ))}
                    </select>
                  </ManagementField>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) =>
                        change(part.partType, field.key, { required: event.target.checked })
                      }
                    />
                    {t('required')}
                  </label>
                </div>
                {field.type === 'number' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ManagementField label={t('unit')}>
                      <input
                        className={managementControl}
                        maxLength={20}
                        value={field.unit}
                        onChange={(event) =>
                          change(part.partType, field.key, { unit: event.target.value })
                        }
                      />
                    </ManagementField>
                    <ManagementField label={t('minimum')}>
                      <input
                        className={managementControl}
                        type="number"
                        step="any"
                        value={field.minimum}
                        onChange={(event) =>
                          change(part.partType, field.key, { minimum: event.target.value })
                        }
                      />
                    </ManagementField>
                  </div>
                )}
                {(['en', 'ar'] as const).map((lang) => (
                  <div
                    key={lang}
                    lang={lang}
                    dir={lang === 'ar' ? 'rtl' : 'ltr'}
                    className="grid gap-4 sm:grid-cols-2"
                  >
                    <ManagementField label={t(`label_${lang}`)}>
                      <input
                        className={managementControl}
                        maxLength={200}
                        value={field[lang].label}
                        onChange={(event) =>
                          change(part.partType, field.key, {
                            [lang]: { ...field[lang], label: event.target.value },
                          })
                        }
                      />
                    </ManagementField>
                    <ManagementField label={t(`instructions_${lang}`)}>
                      <textarea
                        className={managementControl}
                        rows={2}
                        maxLength={1000}
                        value={field[lang].instructions}
                        onChange={(event) =>
                          change(part.partType, field.key, {
                            [lang]: { ...field[lang], instructions: event.target.value },
                          })
                        }
                      />
                    </ManagementField>
                  </div>
                ))}
                {editable && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={index === 0}
                      onClick={() => move(part.partType, index, -1)}
                    >
                      {t('moveUp')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={index === part.fields.length - 1}
                      onClick={() => move(part.partType, index, 1)}
                    >
                      {t('moveDown')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setParts((current) =>
                          current.map((row) =>
                            row.partType === part.partType
                              ? {
                                  ...row,
                                  fields: row.fields.filter((item) => item.key !== field.key),
                                }
                              : row,
                          ),
                        )
                      }
                    >
                      {t('removeField')}
                    </Button>
                  </div>
                )}
              </fieldset>
            ))}
            {editable && (
              <Button
                type="button"
                variant="outline"
                disabled={part.fields.length >= 50}
                onClick={() =>
                  setParts((current) =>
                    current.map((row) =>
                      row.partType === part.partType
                        ? {
                            ...row,
                            fields: [
                              ...row.fields,
                              {
                                key: crypto.randomUUID(),
                                type: 'text',
                                required: false,
                                unit: '',
                                minimum: '',
                                en: { label: '', instructions: '' },
                                ar: { label: '', instructions: '' },
                              },
                            ],
                          }
                        : row,
                    ),
                  )
                }
              >
                {t('addField')}
              </Button>
            )}
          </fieldset>
        </section>
      ))}
      {editable && (
        <Button type="submit" disabled={action.busy || action.locked}>
          {t(action.busy ? 'saving' : 'saveForm')}
        </Button>
      )}
    </form>
  );
}
export function BidFormEditor({ tenderId }: { tenderId: string }) {
  const t = useTranslations('Manage');
  const locale = useLocale();
  const client = useQueryClient();
  const { session } = useSession();
  const [version, setVersion] = useState(0);
  const [saved, setSaved] = useState(false);
  const query = useManageTendersGetBidForm(tenderId, {
    query: {
      queryKey: privateKey(session?.user.id ?? '', ['manage-tenders', locale, 'form', tenderId]),
      enabled: !!session,
      retry: false,
    },
  });
  async function reload() {
    setSaved(false);
    const result = await query.refetch();
    if (result.data && !result.error) setVersion((value) => value + 1);
  }
  async function done() {
    await client.invalidateQueries({
      queryKey: privateKey(session?.user.id ?? '', ['manage-tenders']),
      refetchType: 'none',
    });
    await reload();
    setSaved(true);
  }
  return (
    <section className="space-y-5">
      {saved && (
        <p role="status" className="rounded-md bg-secondary p-3 text-sm">
          {t('saved')}
        </p>
      )}
      <BackLink href={`/manage/tenders/${tenderId}`}>{t('backDetail')}</BackLink>
      <h1 className="text-2xl font-bold">{t('bidForm')}</h1>
      {query.isPending ? (
        <Skeleton className="h-64" />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.status === 404 ? (
          <EmptyState title={t('notFound')} />
        ) : (
          <ErrorState
            title={t('loadFailed')}
            action={<Button onClick={() => void query.refetch()}>{t('retry')}</Button>}
          />
        )
      ) : (
        <BidFormFields
          key={`${tenderId}-${version}`}
          tenderId={tenderId}
          view={query.data}
          done={done}
          reload={reload}
        />
      )}
    </section>
  );
}
export function BidFormFromRoute() {
  const { tenderId } = useParams<{ tenderId: string }>();
  return <BidFormEditor key={tenderId} tenderId={tenderId} />;
}
