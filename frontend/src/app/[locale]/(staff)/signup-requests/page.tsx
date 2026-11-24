import { Suspense } from 'react';
import { StaffGuard } from '@/components/auth/StaffGuard';
import { AdminRequestQueue } from '@/components/signup/ApplicationQueue';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StaffGuard>
        <AdminRequestQueue />
      </StaffGuard>
    </Suspense>
  );
}
