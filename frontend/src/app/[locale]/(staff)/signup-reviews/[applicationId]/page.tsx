import { Suspense } from 'react';
import { StaffGuard } from '@/components/auth/StaffGuard';
import { LegalApplicationFromRoute } from '@/components/signup/ApplicationDetail';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StaffGuard>
        <LegalApplicationFromRoute />
      </StaffGuard>
    </Suspense>
  );
}
