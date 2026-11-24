import { Suspense } from 'react';
import { StaffGuard } from '@/components/auth/StaffGuard';
import { DraftTenderForm } from '@/components/employee/DraftTenderForm';
import { Skeleton } from '@/components/ui/skeleton';

export default function NewTenderPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <StaffGuard>
        <DraftTenderForm />
      </StaffGuard>
    </Suspense>
  );
}
