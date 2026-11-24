import { useLocalSearchParams } from 'expo-router';
import { isRouteId } from '@/api/route-id';
import { ScreenState } from '@/components/screen-state';
import { TenderDetailScreen } from '@/features/tenders';
import { useLocale } from '@/locale/locale-provider';

export default function TenderRoute() {
  const { tenderId } = useLocalSearchParams<{ tenderId: string }>();
  const { copy, locale } = useLocale();
  if (!isRouteId(tenderId)) {
    return <ScreenState message={copy.notFound} />;
  }
  return (
    <TenderDetailScreen key={`${tenderId}:${locale}`} tenderId={tenderId} />
  );
}
