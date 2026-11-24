import { TenderListScreen } from '@/features/tenders';
import { useLocale } from '@/locale/locale-provider';

export default function TenderListRoute() {
  const { locale } = useLocale();
  return <TenderListScreen key={locale} />;
}
