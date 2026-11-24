import { Suspense } from 'react';
import { BidSubmitForm } from '@/components/bids/BidSubmitForm';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-80" />}>
      <BidSubmitForm />
    </Suspense>
  );
}
