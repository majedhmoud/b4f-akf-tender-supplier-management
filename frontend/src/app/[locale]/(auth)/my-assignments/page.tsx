import { Suspense } from 'react';
import { MyAssignments } from '@/components/committees/MyAssignments';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyAssignmentsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <MyAssignments />
    </Suspense>
  );
}
