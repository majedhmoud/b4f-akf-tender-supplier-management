'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field-label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePathname, useRouter } from '@/i18n/navigation';
import {
  getPublicTendersListQueryKey,
  usePublicTendersList,
} from '@/lib/api/generated/public-tenders/public-tenders';
import {
  getReferenceCategoriesQueryKey,
  useReferenceCategories,
} from '@/lib/api/generated/reference/reference';
import { publicKey } from '@/lib/api/query-keys';
import { useServerNow } from '@/lib/useServerNow';
import { TenderCard } from './TenderCard';

const PAGE_SIZE = 12;
const CATEGORY_PARAMS = { limit: 100 };

// The public tender list. The category and page live in the URL, so a filtered
// list can be shared and survives a language switch (CODING_STANDARDS.md §3.3).
export function TenderList() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const now = useServerNow();

  const category = searchParams.get('category') ?? undefined;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const params = { page, limit: PAGE_SIZE, ...(category ? { category } : {}) };

  const tenders = usePublicTendersList(params, {
    query: { queryKey: publicKey(locale, getPublicTendersListQueryKey(params)) },
  });
  const categories = useReferenceCategories(CATEGORY_PARAMS, {
    query: { queryKey: publicKey(locale, getReferenceCategoriesQueryKey(CATEGORY_PARAMS)) },
  });

  function go(next: { category?: string; page?: number }) {
    const query: Record<string, string> = {};
    if (next.category) query.category = next.category;
    if (next.page && next.page > 1) query.page = String(next.page);
    router.replace({ pathname, query });
  }

  const meta = tenders.data?.meta;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 rounded-md bg-deep-green p-6 text-white sm:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t('Tenders.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/75">{t('Tenders.subtitle')}</p>
        </div>
        <label className="flex w-full flex-col gap-2 text-sm sm:max-w-xs">
          <span className="text-xs font-semibold text-white/80">
            <FieldLabel optional>{t('Tenders.categoryFilter')}</FieldLabel>
          </span>
          <select
            value={category ?? ''}
            onChange={(event) => go({ category: event.target.value || undefined })}
            className="field-control h-11 w-auto"
          >
            <option value="">{t('Tenders.allCategories')}</option>
            {categories.data?.data.map(({ code }) => (
              <option key={code} value={code}>
                {t(`Categories.${code}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tenders.isPending && (
        <div className="grid gap-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-md" />
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
        <EmptyState title={category ? t('Tenders.emptyInCategory') : t('Tenders.empty')} />
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

      {meta && meta.totalPages > 1 && (
        <nav
          className="flex flex-wrap items-center justify-center gap-3 panel p-3 text-sm"
          aria-label={t('Common.pagination')}
        >
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => go({ category, page: page - 1 })}
          >
            {t('Common.previous')}
          </Button>
          <span>{t('Common.pageOf', { page, totalPages: meta.totalPages })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= meta.totalPages}
            onClick={() => go({ category, page: page + 1 })}
          >
            {t('Common.next')}
          </Button>
        </nav>
      )}
    </section>
  );
}
