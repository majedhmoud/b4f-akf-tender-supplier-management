import { Suspense } from 'react';
import { AccountSetup } from '@/components/account/AccountSetup';
import { Skeleton } from '@/components/ui/skeleton';

export default function AccountSetupPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-80 max-w-lg" />}>
      <AccountSetup />
    </Suspense>
  );
}
