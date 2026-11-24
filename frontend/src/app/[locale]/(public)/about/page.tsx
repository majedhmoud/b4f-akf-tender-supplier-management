import { setRequestLocale } from 'next-intl/server';
import { PublicInfoPage } from '@/components/layout/PublicInfoPage';

export default async function Page({ params }: PageProps<'/[locale]/about'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PublicInfoPage locale={locale} page="About" />;
}
