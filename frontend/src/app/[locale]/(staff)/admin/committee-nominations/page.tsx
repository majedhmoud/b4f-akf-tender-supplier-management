import { Suspense } from 'react';
import { StaffGuard } from '@/components/auth/StaffGuard';
import { AdminNominationQueue } from '@/components/committees/AdminNominationQueue';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StaffGuard>
        <AdminNominationQueue />
      </StaffGuard>
    </Suspense>
  );
}
