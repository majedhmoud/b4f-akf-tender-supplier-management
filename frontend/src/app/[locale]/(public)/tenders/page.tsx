import { setRequestLocale } from 'next-intl/server';
import { Suspense, use } from 'react';
import { TenderList } from '@/components/tenders/TenderList';
import { CardListSkeleton } from '@/components/ui/loading';

export default function TendersPage({ params }: PageProps<'/[locale]/tenders'>) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return (
    <Suspense fallback={<CardListSkeleton count={6} />}>
      <TenderList />
    </Suspense>
  );
}
