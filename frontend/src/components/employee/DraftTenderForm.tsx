'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Link, useRouter } from '@/i18n/navigation';
import {
  useEmployeeTendersCreate,
  useEmployeeTendersUpdate,
} from '@/lib/api/generated/employee-tenders/employee-tenders';
import type { EmployeeTender, TenderTranslationDto } from '@/lib/api/generated/model';
import { useReferenceCategories } from '@/lib/api/generated/reference/reference';
import { ApiError } from '@/lib/api/mutator';
import { privateKey, publicKey } from '@/lib/api/query-keys';
import { useSession } from '@/lib/useSession';

const languages = ['en', 'ar'] as const;
const controlClassName = 'field-control';

export function DraftTenderForm({
  initial,
  onReload,
}: {
  initial?: EmployeeTender;
  onReload?: () => Promise<void>;
}) {
  const t = useTranslations('Employee');
  const common = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useSession();
  // Preserve the revision this form was opened with until an explicit reload.
  const [base] = useState(initial);
  const [categoryCode, setCategory] = useState(initial?.categoryCode ?? '');
  const [amount, setAmount] = useState(initial?.estimatedBalance.amount ?? '');
  const [currency, setCurrency] = useState(initial?.estimatedBalance.currency ?? '');
  const [texts, setTexts] = useState(() =>
    Object.fromEntries(
      languages.map((language) => {
        const row = initial?.translations.find((item) => item.language === language);
        return [language, { title: row?.title ?? '', description: row?.description ?? '' }];
      }),
    ),
  );
  const [section, setSection] = useState('basics');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const create = useEmployeeTendersCreate<ApiError>({ mutation: { retry: false } });
  const update = useEmployeeTendersUpdate<ApiError>({ mutation: { retry: false } });
  const categories = useReferenceCategories(
    { limit: 100 },
    {
      query: { queryKey: publicKey(locale, ['categories', 'employee-form']), retry: false },
    },
  );

  // Reveal and focus errors even when Save is pressed from a different tab.
  useEffect(() => {
    const first = Object.keys(fields)[0];
    const ids: Record<string, string> = {
      categoryCode: 'category',
      'estimatedBalance.amount': 'amount',
      'estimatedBalance.currency': 'currency',
      'en.title': 'en-title',
      'en.description': 'en-description',
      'ar.title': 'ar-title',
      'ar.description': 'ar-description',
    };
    if (ids[first]) document.getElementById(ids[first])?.focus();
  }, [fields]);

  function showErrors(errors: Record<string, string>) {
    setFields(errors);
    const first = Object.keys(errors)[0];
    if (first) setSection(/^(en|ar)\./.test(first) ? 'translations' : 'basics');
  }

  function changeText(language: string, field: 'title' | 'description', value: string) {
    setTexts((current) => ({ ...current, [language]: { ...current[language], [field]: value } }));
  }

  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || locked || !session) return;
    const errors: Record<string, string> = {};
    if (!categoryCode) errors.categoryCode = t('required');
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount))
      errors['estimatedBalance.amount'] = t('invalidAmount');
    if (!/^[A-Z]{3}$/.test(currency)) errors['estimatedBalance.currency'] = t('invalidCurrency');
    const translations: TenderTranslationDto[] = [];
    for (const language of languages) {
      const title = texts[language].title.trim();
      const description = texts[language].description.trim();
      if (!title && !description) continue;
      if (!title) errors[language + '.title'] = t('required');
      if (!description) errors[language + '.description'] = t('required');
      translations.push({ language, title, description });
    }
    if (!translations.length) errors['en.title'] = t('oneLanguage');
    showErrors(errors);
    setFailure(null);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      const data = { categoryCode, estimatedBalance: { amount, currency }, translations };
      const result = base
        ? await update.mutateAsync({
            tenderId: base.id,
            data: { ...data, revision: base.revision },
          })
        : await create.mutateAsync({ data });
      await client.invalidateQueries({
        queryKey: privateKey(session.user.id, ['employee-tenders']),
      });
      const id = base ? base.id : 'id' in result ? result.id : '';
      router.push(`/employee/tenders/${id}`);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
      setFailure(code);
      if (code === 'TENDER_STATUS_CHANGED' || code === 'NOT_FOUND') {
        setLocked(true);
        await client.invalidateQueries({
          queryKey: privateKey(session.user.id, ['employee-tenders']),
        });
      }
      if (error instanceof ApiError && code === 'VALIDATION_FAILED') {
        const inline: Record<string, string> = {};
        for (const field of error.fields) {
          const normalized = field.field.replace(/\[(\d+)\]/g, '.$1');
          const translation = /^translations\.(\d+)\.(title|description)$/.exec(normalized);
          const key = translation
            ? translations[Number(translation[1])]?.language + '.' + translation[2]
            : normalized;
          inline[key] = t('invalidField');
        }
        showErrors(inline);
      }
    } finally {
      setSaving(false);
    }
  }

  function fieldHint(name: string) {
    return fields[name] ? (
      <p id={name + '-error'} className="text-xs text-destructive">
        {fields[name]}
      </p>
    ) : null;
  }
  function fieldAttributes(name: string) {
    return {
      'aria-invalid': !!fields[name],
      'aria-describedby': fields[name] ? name + '-error' : undefined,
    };
  }
  const errorLabels: Record<string, string> = {
    VERSION_CONFLICT: 'conflict',
    TENDER_STATUS_CHANGED: 'statusChanged',
    VALIDATION_FAILED: 'validationFailed',
    NOT_FOUND: 'notFound',
  };

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{base ? t('edit') : t('create')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('draftOnly')}</p>
        </div>
        <Button type="submit" disabled={saving || locked || !categories.data}>
          {saving ? t('saving') : t('save')}
        </Button>
      </header>
      {failure && (
        <ErrorState
          title={t(errorLabels[failure] ?? 'saveFailed')}
          action={
            failure === 'VERSION_CONFLICT' && onReload ? (
              <Button type="button" variant="outline" onClick={() => void onReload()}>
                {t('reloadDiscard')}
              </Button>
            ) : undefined
          }
        />
      )}
      {categories.isError && (
        <ErrorState
          title={t('categoriesFailed')}
          action={
            <Button type="button" onClick={() => void categories.refetch()}>
              {common('Common.retry')}
            </Button>
          }
        />
      )}
      <Tabs dir={locale === 'ar' ? 'rtl' : 'ltr'} value={section} onValueChange={setSection}>
        <TabsList aria-label={t('sections')}>
          <TabsTrigger value="basics">{t('basics')}</TabsTrigger>
          <TabsTrigger value="translations">{t('translations')}</TabsTrigger>
        </TabsList>
        <fieldset disabled={saving || locked} className="min-w-0">
          <TabsContent value="basics" keepMounted>
            <h2 className="mb-5 font-bold">{t('basics')}</h2>
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <label htmlFor="category" className="mb-2 block text-sm">
                  {t('category')}
                </label>
                <select
                  id="category"
                  value={categoryCode}
                  onChange={(event) => setCategory(event.target.value)}
                  className={controlClassName}
                  {...fieldAttributes('categoryCode')}
                >
                  <option value="">{t('chooseCategory')}</option>
                  {categories.data?.data.map(({ code }) => (
                    <option key={code} value={code}>
                      {common(`Categories.${code}`)}
                    </option>
                  ))}
                </select>
                {fieldHint('categoryCode')}
              </div>
              <div>
                <label htmlFor="amount" className="mb-2 block text-sm">
                  {t('amount')}
                </label>
                <input
                  id="amount"
                  dir="ltr"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className={controlClassName}
                  {...fieldAttributes('estimatedBalance.amount')}
                />
                {fieldHint('estimatedBalance.amount')}
              </div>
              <div>
                <label htmlFor="currency" className="mb-2 block text-sm">
                  {t('currency')}
                </label>
                <input
                  id="currency"
                  dir="ltr"
                  maxLength={3}
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                  className={controlClassName}
                  {...fieldAttributes('estimatedBalance.currency')}
                />
                {fieldHint('estimatedBalance.currency')}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="translations" keepMounted>
            <h2 className="font-bold">{t('translations')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('translationHint')}</p>
            <div className="mt-5 grid gap-6 xl:grid-cols-2">
              {languages.map((language) => (
                <fieldset key={language} className="flex min-w-0 flex-col gap-4">
                  <legend className="mb-4 text-sm font-semibold">{t(language)}</legend>
                  <div>
                    <label htmlFor={language + '-title'} className="mb-2 block text-sm">
                      {t('titleIn', { language: t(language) })}
                    </label>
                    <input
                      id={language + '-title'}
                      lang={language}
                      dir={language === 'ar' ? 'rtl' : 'ltr'}
                      maxLength={200}
                      value={texts[language].title}
                      onChange={(event) => changeText(language, 'title', event.target.value)}
                      className={controlClassName}
                      {...fieldAttributes(language + '.title')}
                    />
                    {fieldHint(language + '.title')}
                  </div>
                  <div>
                    <label htmlFor={language + '-description'} className="mb-2 block text-sm">
                      {t('descriptionIn', { language: t(language) })}
                    </label>
                    <textarea
                      id={language + '-description'}
                      lang={language}
                      dir={language === 'ar' ? 'rtl' : 'ltr'}
                      rows={6}
                      maxLength={10000}
                      value={texts[language].description}
                      onChange={(event) => changeText(language, 'description', event.target.value)}
                      className={controlClassName}
                      {...fieldAttributes(language + '.description')}
                    />
                    {fieldHint(language + '.description')}
                  </div>
                </fieldset>
              ))}
            </div>
          </TabsContent>
        </fieldset>
      </Tabs>
      <Link
        href={base ? `/employee/tenders/${base.id}` : '/employee/tenders'}
        className="self-start text-sm text-primary hover:underline"
      >
        {t('back')}
      </Link>
    </form>
  );
}
