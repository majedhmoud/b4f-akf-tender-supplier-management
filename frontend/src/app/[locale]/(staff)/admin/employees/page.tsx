import { Suspense } from 'react';
import { StaffGuard } from '@/components/auth/StaffGuard';
import { EmployeeAccountForm } from '@/components/employee/EmployeeAccountForm';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StaffGuard>
        <EmployeeAccountForm />
      </StaffGuard>
    </Suspense>
  );
}
