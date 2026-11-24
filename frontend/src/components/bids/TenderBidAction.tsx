'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { useTenderBidsForm } from '@/lib/api/generated/bids/bids';
import { privateKey } from '@/lib/api/query-keys';
import { useSession } from '@/lib/useSession';

// The bid entry point on a published tender, for suppliers only (B1).
export function TenderBidAction({ tenderId }: { tenderId: string }) {
  const t = useTranslations('Bids');
  const locale = useLocale();
  const { session } = useSession();
  const isSupplier = session?.user.roles.includes('supplier') ?? false;
  const query = useTenderBidsForm(tenderId, {
    query: {
      queryKey: privateKey(session?.user.id ?? '', ['bid-form', locale, tenderId]),
      enabled: isSupplier,
      retry: false,
    },
  });
  if (!isSupplier) return null;
  if (query.isPending) return <Skeleton className="h-28" />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        title={t('loadFailed')}
        action={<Button onClick={() => void query.refetch()}>{t('retry')}</Button>}
      />
    );
  const form = query.data;
  const link =
    'inline-flex min-h-10 items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold';
  return (
    <section className="panel space-y-3 p-5">
      <h2 className="text-base font-bold">{t('bidTitle')}</h2>
      {form.canSubmit ? (
        <Link
          href={`/tenders/${tenderId}/bid`}
          className={`${link} border-primary bg-primary text-primary-foreground hover:bg-deep-green`}
        >
          {t('submitBid')}
        </Link>
      ) : (
        <>
          <p className="text-sm">{t(`reasons.${form.reasonCode ?? 'APPLICATION_CLOSED'}`)}</p>
          {form.existingBid && (
            <Link
              href={`/my-bids/${form.existingBid.bidId}`}
              className={`${link} border-input bg-card text-primary hover:border-primary hover:bg-secondary`}
            >
              {t('viewBid')}
            </Link>
          )}
        </>
      )}
    </section>
  );
}
