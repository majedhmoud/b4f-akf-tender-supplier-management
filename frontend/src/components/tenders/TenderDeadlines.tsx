import { useLocale, useTranslations } from 'next-intl';
import type { TenderDeadlines as Deadlines } from '@/lib/api/generated/model';
import { formatDateTime, formatRelative, isPast } from '@/lib/format';

const deadlineKinds = ['application', 'technical', 'financial'] as const;

export function TenderDeadlines({ deadlines, now }: { deadlines: Deadlines; now?: number | null }) {
  const t = useTranslations('Tender');
  const locale = useLocale();

  return (
    <section aria-label={t('deadlines')} className="min-w-0 panel border-s-4 border-s-primary p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-bold">{t('deadlines')}</h2>
      <dl className="grid gap-3">
        {deadlineKinds.map((kind) => {
          const at = deadlines[kind];
          const passed = typeof now === 'number' && isPast(at, now);
          return (
            <div key={kind} className="grid gap-1 rounded-md bg-muted/60 px-4 py-3">
              <dt className="text-sm font-semibold text-primary">{t(kind)}</dt>
              <dd>
                <time dateTime={at} className="block font-semibold text-foreground">
                  {formatDateTime(locale, at)}
                </time>
                {now !== undefined && (
                  <p className={passed ? 'mt-1 text-sm text-destructive' : 'mt-1 text-sm text-muted-foreground'}>
                    {passed
                      ? t('passed')
                      : t('closesIn', { when: now === null ? '…' : formatRelative(locale, at, now) })}
                  </p>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
