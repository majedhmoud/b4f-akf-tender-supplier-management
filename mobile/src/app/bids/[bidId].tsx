import { Redirect, useLocalSearchParams } from 'expo-router';
import { isRouteId } from '@/api/route-id';
import { ScreenState } from '@/components/screen-state';
import { useSession } from '@/features/auth';
import { BidDetailScreen } from '@/features/bids';
import { useLocale } from '@/locale/locale-provider';

export default function BidRoute() {
  const { bidId } = useLocalSearchParams<{ bidId: string }>();
  const { copy, locale } = useLocale();
  const { state } = useSession();
  if (state.status === 'restoring')
    return <ScreenState message={copy.restoring} loading />;
  if (state.status !== 'signedIn') return <Redirect href="/bids" />;
  if (!isRouteId(bidId)) return <ScreenState message={copy.bidMissing} />;
  return (
    <BidDetailScreen
      key={`${state.user.id}:${bidId}:${locale}`}
      bidId={bidId}
    />
  );
}
