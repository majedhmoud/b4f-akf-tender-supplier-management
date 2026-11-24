import { setRequestLocale } from 'next-intl/server';
import { Suspense, use } from 'react';
import { TenderList } from '@/components/tenders/TenderList';

export default function TendersPage({ params }: PageProps<'/[locale]/tenders'>) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return (
    <Suspense>
      <TenderList />
    </Suspense>
  );
}
