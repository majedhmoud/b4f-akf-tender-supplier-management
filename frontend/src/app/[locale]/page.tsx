import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { redirect } from '@/i18n/navigation';

// The public tender list is the start page.
export default function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = use(params);
  setRequestLocale(locale);
  redirect({ href: '/tenders', locale });
}
