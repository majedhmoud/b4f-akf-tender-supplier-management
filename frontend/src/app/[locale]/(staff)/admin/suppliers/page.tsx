import { Suspense } from 'react';
import { StaffGuard } from '@/components/auth/StaffGuard';
import { AdminSupplierDirectory } from '@/components/suppliers/AdminSupplierDirectory';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StaffGuard>
        <AdminSupplierDirectory />
      </StaffGuard>
    </Suspense>
  );
}
