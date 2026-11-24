import { Suspense } from 'react';
import { StaffGuard } from '@/components/auth/StaffGuard';
import { ManagedTenderList } from '@/components/manage/ManagedTenderList';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StaffGuard>
        <ManagedTenderList />
      </StaffGuard>
    </Suspense>
  );
}
