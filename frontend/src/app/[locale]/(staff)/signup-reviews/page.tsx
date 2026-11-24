import { Suspense } from 'react';
import { StaffGuard } from '@/components/auth/StaffGuard';
import { LegalReviewQueue } from '@/components/signup/ApplicationQueue';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StaffGuard>
        <LegalReviewQueue />
      </StaffGuard>
    </Suspense>
  );
}
