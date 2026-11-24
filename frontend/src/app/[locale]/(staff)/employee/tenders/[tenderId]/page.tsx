import { StaffGuard } from '@/components/auth/StaffGuard';
import { Suspense } from 'react';
import { EmployeeTenderFromRoute } from '@/components/employee/EmployeeTenderDetail';
import { Skeleton } from '@/components/ui/skeleton';

export default function EmployeeTenderPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StaffGuard>
        <EmployeeTenderFromRoute />
      </StaffGuard>
    </Suspense>
  );
}
