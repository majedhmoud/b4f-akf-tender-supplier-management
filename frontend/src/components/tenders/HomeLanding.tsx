'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import {
  getPublicTendersListQueryKey,
  usePublicTendersList,
} from '@/lib/api/generated/public-tenders/public-tenders';
import { publicKey } from '@/lib/api/query-keys';
import { useServerNow } from '@/lib/useServerNow';
import heroMap from '@/components/ui/assets/syria-dotted-map-hero.png';
import { TenderCard } from './TenderCard';

const PREVIEW_PARAMS = { page: 1, limit: 3 };

export function HomeLanding() {
  const t = useTranslations();
  const locale = useLocale();
  const now = useServerNow();
  const tenders = usePublicTendersList(PREVIEW_PARAMS, {
    query: {
      queryKey: publicKey(locale, getPublicTendersListQueryKey(PREVIEW_PARAMS)),
    },
  });

  return (
    <div className="flex flex-col gap-12">
      <section className="relative isolate overflow-hidden rounded-md bg-deep-green px-6 py-10 text-white shadow-sm sm:px-10 sm:py-14 lg:px-14">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <Image src={heroMap} alt="" fill sizes="100vw" className="object-cover opacity-75" />
          <div className="absolute inset-0 bg-deep-green/30" />
        </div>
        <div className="relative z-10 max-w-3xl space-y-5 lg:max-w-[58%]">
          <p className="text-sm font-semibold tracking-wide text-advisory-border">
            {t('Home.eyebrow')}
          </p>
          <h1 className="max-w-2xl text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t('Home.title')}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
            {t('Home.subtitle')}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/tenders" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
              {t('Home.browseTenders')}
            </Link>
            <Link
              href="/supplier-application"
              className={buttonVariants({
                variant: 'outline',
                size: 'lg',
                className:
                  'border-white/40 bg-white/5 text-white hover:bg-white/10 hover:text-white',
              })}
            >
              {t('Home.applyAsSupplier')}
            </Link>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5" aria-labelledby="recent-tenders-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="recent-tenders-heading"
              className="text-xl font-bold tracking-tight text-deep-green sm:text-2xl"
            >
              {t('Home.recentTenders')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('Home.recentTendersHint')}</p>
          </div>
          <Link href="/tenders" className={buttonVariants({ variant: 'outline' })}>
            {t('Home.viewAllTenders')}
          </Link>
        </div>

        {tenders.isPending && (
          <div className="grid gap-3" aria-busy="true">
            {Array.from({ length: PREVIEW_PARAMS.limit }, (_, index) => (
              <Skeleton key={index} className="h-32 rounded-md" />
            ))}
          </div>
        )}

        {tenders.isError && (
          <ErrorState
            title={t('Tenders.loadError')}
            action={
              <Button variant="outline" size="sm" onClick={() => tenders.refetch()}>
                {t('Common.retry')}
              </Button>
            }
          />
        )}

        {tenders.data && tenders.data.data.length === 0 && (
          <EmptyState title={t('Tenders.empty')} />
        )}

        {tenders.data && tenders.data.data.length > 0 && (
          <ul className="grid gap-3">
            {tenders.data.data.map((tender) => (
              <li key={tender.id}>
                <TenderCard tender={tender} now={now} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
