'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import type { ManagedTender } from '@/lib/api/generated/model';
import { useReferenceCategories } from '@/lib/api/generated/reference/reference';
import {
  useManageTendersAccept,
  useManageTendersUpdate,
  useManageTendersPublish,
} from '@/lib/api/generated/tender-management/tender-management';
import { serverNow } from '@/lib/api/mutator';
import { publicKey } from '@/lib/api/query-keys';
import {
  ManagementFeedback,
  ManagementField,
  managementControl,
  useManagementAction,
} from './ManagementFeedback';

type Props = { tender: ManagedTender; done: () => Promise<void>; reload: () => Promise<void> };
export function ManagedTenderForm({ tender, done, reload }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const [base] = useState(tender);
  const accepting = base.status === 'draft';
  const [categoryCode, setCategory] = useState(base.categoryCode);
  const [amount, setAmount] = useState(base.estimatedBalance.amount);
  const [currency, setCurrency] = useState(base.estimatedBalance.currency);
  const [translations, setTranslations] = useState(() =>
    (['en', 'ar'] as const).map((language) => ({
      language,
      title: base.translations.find((row) => row.language === language)?.title ?? '',
      description: base.translations.find((row) => row.language === language)?.description ?? '',
    })),
  );
  const [scores, setScores] = useState({
    technicalWeight: base.scoring?.technicalWeight.toString() ?? '',
    financialWeight: base.scoring?.financialWeight.toString() ?? '',
    minimumTechnicalScore: base.scoring?.minimumTechnicalScore.toString() ?? '',
  });
  const [invalid, setInvalid] = useState(false);
  const action = useManagementAction();
  const accept = useManageTendersAccept({ mutation: { retry: false } });
  const update = useManageTendersUpdate({ mutation: { retry: false } });
  const categories = useReferenceCategories(
    { limit: 100 },
    { query: { queryKey: publicKey(locale, ['categories', 'manage-form']), retry: false } },
  );
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const scoring = {
      technicalWeight: Number(scores.technicalWeight),
      financialWeight: Number(scores.financialWeight),
      minimumTechnicalScore: Number(scores.minimumTechnicalScore),
    };
    const filled = translations
      .filter((row) => row.title.trim() || row.description.trim())
      .map((row) => ({ ...row, title: row.title.trim(), description: row.description.trim() }));
    const validScores =
      Object.values(scores).every(
        (value) =>
          value.trim() !== '' &&
          Number.isInteger(Number(value)) &&
          Number(value) >= 0 &&
          Number(value) <= 100,
      ) && scoring.technicalWeight + scoring.financialWeight === 100;
    if (
      !validScores ||
      (!accepting &&
        (!categoryCode ||
          !/^\d{1,12}(\.\d{1,2})?$/.test(amount) ||
          !/^[A-Z]{3}$/.test(currency) ||
          !filled.length ||
          filled.some((row) => !row.title || !row.description)))
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    await action.run(
      () =>
        accepting
          ? accept.mutateAsync({ tenderId: base.id, data: { revision: base.revision, ...scoring } })
          : update.mutateAsync({
              tenderId: base.id,
              data: {
                revision: base.revision,
                categoryCode,
                estimatedBalance: { amount, currency },
                translations: filled,
                scoring,
              },
            }),
      done,
    );
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-5 panel p-5">
      <h2 className="text-lg font-bold">{t(accepting ? 'Manage.accept' : 'Manage.edit')}</h2>
      <ManagementFeedback error={action.error} reload={reload} />
      {invalid && <ErrorState title={t('Manage.formInvalid')} />}
      {categories.isError && !accepting && (
        <ErrorState
          title={t('Employee.categoriesFailed')}
          action={
            <Button type="button" onClick={() => void categories.refetch()}>
              {t('Common.retry')}
            </Button>
          }
        />
      )}
      <fieldset disabled={action.busy || action.locked} className="space-y-5">
        {!accepting && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <ManagementField label={t('Employee.category')}>
                <select
                  className={managementControl}
                  value={categoryCode}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {categories.data?.data.map(({ code }) => (
                    <option key={code} value={code}>
                      {t(`Categories.${code}`)}
                    </option>
                  ))}
                </select>
              </ManagementField>
              <ManagementField label={t('Employee.amount')}>
                <input
                  className={managementControl}
                  dir="ltr"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </ManagementField>
              <ManagementField label={t('Employee.currency')}>
                <input
                  className={managementControl}
                  dir="ltr"
                  maxLength={3}
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                />
              </ManagementField>
            </div>
            {translations.map((row, index) => (
              <div
                key={row.language}
                className="space-y-3"
                dir={row.language === 'ar' ? 'rtl' : 'ltr'}
                lang={row.language}
              >
                <ManagementField
                  label={t('Employee.titleIn', { language: t(`Employee.${row.language}`) })}
                >
                  <input
                    className={managementControl}
                    maxLength={200}
                    value={row.title}
                    onChange={(event) =>
                      setTranslations((rows) =>
                        rows.map((item, i) =>
                          i === index ? { ...item, title: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </ManagementField>
                <ManagementField
                  label={t('Employee.descriptionIn', { language: t(`Employee.${row.language}`) })}
                >
                  <textarea
                    className={managementControl}
                    rows={4}
                    maxLength={10000}
                    value={row.description}
                    onChange={(event) =>
                      setTranslations((rows) =>
                        rows.map((item, i) =>
                          i === index ? { ...item, description: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </ManagementField>
              </div>
            ))}
          </>
        )}
        <p className="text-sm text-muted-foreground">{t('Manage.scoringHint')}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(['technicalWeight', 'financialWeight', 'minimumTechnicalScore'] as const).map((key) => (
            <ManagementField key={key} label={t(`Manage.${key}`)}>
              <input
                className={managementControl}
                dir="ltr"
                type="number"
                min={0}
                max={100}
                step={1}
                value={scores[key]}
                onChange={(event) =>
                  setScores((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </ManagementField>
          ))}
        </div>
        <Button type="submit" disabled={action.busy || (!accepting && !categories.data)}>
          {t(action.busy ? 'Manage.saving' : accepting ? 'Manage.accept' : 'Manage.save')}
        </Button>
      </fieldset>
    </form>
  );
}

export function PublishTenderForm({ tender, done, reload }: Props) {
  const t = useTranslations('Manage');
  const [base] = useState(tender);
  const [deadlines, setDeadlines] = useState({ application: '', technical: '', financial: '' });
  const [invalid, setInvalid] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const action = useManagementAction();
  const publish = useManageTendersPublish({ mutation: { retry: false } });
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const times = [deadlines.application, deadlines.technical, deadlines.financial].map((value) =>
      Date.parse(value),
    );
    if (times.some((value) => !Number.isFinite(value)) || !confirmed) {
      setInvalid('publishRequired');
      return;
    }
    if (times[0] <= serverNow()) {
      setInvalid('deadlinePast');
      return;
    }
    if (times[0] >= times[1] || times[1] >= times[2]) {
      setInvalid('deadlineOrder');
      return;
    }
    setInvalid(null);
    await action.run(
      () =>
        publish.mutateAsync({
          tenderId: base.id,
          data: {
            revision: base.revision,
            categoryCode: base.categoryCode,
            deadlines: {
              application: new Date(times[0]).toISOString(),
              technical: new Date(times[1]).toISOString(),
              financial: new Date(times[2]).toISOString(),
            },
          },
        }),
      done,
    );
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-5 panel p-5">
      <h2 className="text-lg font-bold">{t('publish')}</h2>
      <p className="text-sm text-muted-foreground">{t('publishHint')}</p>
      <p className="text-xs text-muted-foreground">{t('localTimes')}</p>
      <ManagementFeedback error={action.error} reload={reload} />
      {invalid && <ErrorState title={t(invalid)} />}
      <fieldset disabled={action.busy || action.locked} className="space-y-4">
        {(['application', 'technical', 'financial'] as const).map((key) => (
          <ManagementField key={key} label={t(`deadline_${key}`)}>
            <input
              className={managementControl}
              type="datetime-local"
              value={deadlines[key]}
              onChange={(event) =>
                setDeadlines((current) => ({ ...current, [key]: event.target.value }))
              }
            />
          </ManagementField>
        ))}
        <label className="flex items-start gap-3 text-sm">
          <input
            className="mt-1"
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          {t('publishConfirm')}
        </label>
        <Button type="submit" disabled={action.busy}>
          {t(action.busy ? 'saving' : 'publish')}
        </Button>
      </fieldset>
    </form>
  );
}
