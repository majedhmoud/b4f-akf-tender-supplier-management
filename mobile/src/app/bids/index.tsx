import { ScreenState } from '@/components/screen-state';
import { SignInScreen, useSession } from '@/features/auth';
import { BidListScreen } from '@/features/bids';
import { useLocale } from '@/locale/locale-provider';

export default function BidsRoute() {
  const { copy, locale } = useLocale();
  const { state } = useSession();
  if (state.status === 'restoring')
    return <ScreenState message={copy.restoring} loading />;
  if (state.status === 'signingOut')
    return <ScreenState message={copy.signingOut} loading />;
  if (state.status !== 'signedIn') return <SignInScreen />;
  return <BidListScreen key={`${state.user.id}:${locale}`} />;
}
