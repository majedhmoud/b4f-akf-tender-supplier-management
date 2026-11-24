import { Suspense } from 'react';
import { SupplierApplicationForm } from '@/components/signup/SupplierApplicationForm';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <SupplierApplicationForm />
    </Suspense>
  );
}
