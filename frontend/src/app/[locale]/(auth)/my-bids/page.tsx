import { Suspense } from 'react';
import { StaffGuard } from '@/components/auth/StaffGuard';
import { MyBids } from '@/components/bids/MyBids';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StaffGuard>
        <MyBids />
      </StaffGuard>
    </Suspense>
  );
}
