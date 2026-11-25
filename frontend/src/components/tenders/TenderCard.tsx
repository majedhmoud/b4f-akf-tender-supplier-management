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
    <Card className="grid min-w-0 gap-4 rounded-lg border-s-4 border-s-primary/50 px-5 py-5 ring-0 transition-colors hover:border-primary">
      <CardHeader className="min-w-0 gap-3 px-0">
        <CardTitle className="text-lg font-semibold">
          <Link
            href={`/tenders/${tender.id}`}
            lang={tender.content.language}
            dir={directionOf(tender.content.language)}
            className="block break-words text-deep-green underline-offset-4 hover:text-primary hover:underline"
          >
            {tender.content.title}
          </Link>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="border-border bg-muted/50 text-muted-foreground">
            {t(`Categories.${tender.categoryCode}`)}
          </Badge>
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
          <Badge
            variant="secondary"
            className={closed ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-primary'}
          >
            {closed ? t('Statuses.closed') : t(`Statuses.${tender.status}`)}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex min-w-0 flex-[1_1_10rem] flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-muted/60 px-3 py-3 text-sm text-muted-foreground">
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
          <Link
            href={`/tenders/${tender.id}`}
            className={buttonVariants({ size: 'lg', className: 'ms-auto' })}
          >
            {t('Tenders.view')}
          </Link>
        </div>
      </CardHeader>
    </Card>
  );
}
