import { Suspense } from 'react';
import { StaffGuard } from '@/components/auth/StaffGuard';
import { ManagedTenderFromRoute } from '@/components/manage/ManagedTenderDetail';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StaffGuard>
        <ManagedTenderFromRoute />
      </StaffGuard>
    </Suspense>
  );
}
