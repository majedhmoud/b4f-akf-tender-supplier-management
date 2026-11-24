import { Suspense } from 'react';
import { StaffGuard } from '@/components/auth/StaffGuard';
import { AdminRequestFromRoute } from '@/components/signup/ApplicationDetail';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StaffGuard>
        <AdminRequestFromRoute />
      </StaffGuard>
    </Suspense>
  );
}
