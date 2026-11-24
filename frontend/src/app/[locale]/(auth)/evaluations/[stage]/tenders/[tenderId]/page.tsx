import { Suspense } from 'react';
import { EvaluationQueue } from '@/components/evaluations/EvaluationQueue';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <EvaluationQueue />
    </Suspense>
  );
}
