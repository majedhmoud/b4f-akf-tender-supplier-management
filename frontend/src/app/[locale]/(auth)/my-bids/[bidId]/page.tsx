import { Suspense } from 'react';
import { StaffGuard } from '@/components/auth/StaffGuard';
import { MyBidDetail } from '@/components/bids/MyBidDetail';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StaffGuard>
        <MyBidDetail />
      </StaffGuard>
    </Suspense>
  );
}
