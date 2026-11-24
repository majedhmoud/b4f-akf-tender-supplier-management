import { StaffGuard } from '@/components/auth/StaffGuard';
import { Suspense } from 'react';
import { EmployeeTenderList } from '@/components/employee/EmployeeTenderList';
import { Skeleton } from '@/components/ui/skeleton';

export default function EmployeeTendersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-60" />}>
      <StaffGuard>
        <EmployeeTenderList />
      </StaffGuard>
    </Suspense>
  );
}
