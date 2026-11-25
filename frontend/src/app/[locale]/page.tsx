import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { HomeLanding } from '@/components/tenders/HomeLanding';

export default function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return <HomeLanding />;
}
