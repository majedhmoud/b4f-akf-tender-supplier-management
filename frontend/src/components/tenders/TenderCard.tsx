import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import type { PublicTenderSummary } from '@/lib/api/generated/model';
import { directionOf, formatDateTime, formatRelative, isPast, languageName } from '@/lib/format';

export function TenderCard({ tender, now }: { tender: PublicTenderSummary; now: number | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const closed = now !== null && isPast(tender.applicationDeadline, now);

  return (
    <Card className="grid min-w-0 gap-4 rounded-md border px-5 py-4 ring-0 md:grid-cols-[minmax(0,1fr)_7rem_11rem] md:items-center">
      <CardHeader className="min-w-0 gap-2 px-0">
        <CardTitle className="text-base font-semibold">
          <Link
            href={`/tenders/${tender.id}`}
            lang={tender.content.language}
            dir={directionOf(tender.content.language)}
            className="block break-words text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {tender.content.title}
          </Link>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{t(`Categories.${tender.categoryCode}`)}</span>
          {tender.isFallback && (
            <Badge
              variant="outline"
              className="border-transparent bg-advisory text-advisory-foreground"
            >
              {t('Tenders.fallbackShort', {
                language: languageName(locale, tender.content.language),
              })}
            </Badge>
          )}
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {closed
              ? t('Tenders.closed')
              : t('Tenders.closes', {
                  when:
                    now === null ? '…' : formatRelative(locale, tender.applicationDeadline, now),
                })}
          </span>
          <time dateTime={tender.applicationDeadline}>
            {formatDateTime(locale, tender.applicationDeadline)}
          </time>
        </p>
      </CardHeader>
      <Badge
        variant="secondary"
        className={closed ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-primary'}
      >
        {closed ? t('Statuses.closed') : t(`Statuses.${tender.status}`)}
      </Badge>
      <Link href={`/tenders/${tender.id}`} className={buttonVariants({ size: 'lg' })}>
        {t('Tenders.view')}
      </Link>
    </Card>
  );
}
