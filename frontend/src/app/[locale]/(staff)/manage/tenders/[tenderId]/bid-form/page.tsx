import { Suspense } from 'react';
import { StaffGuard } from '@/components/auth/StaffGuard';
import { BidFormFromRoute } from '@/components/manage/BidFormEditor';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StaffGuard>
        <BidFormFromRoute />
      </StaffGuard>
    </Suspense>
  );
}
