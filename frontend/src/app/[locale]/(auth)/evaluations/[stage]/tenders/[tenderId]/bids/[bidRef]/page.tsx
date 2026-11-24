import { Suspense } from 'react';
import { EvaluationBid } from '@/components/evaluations/EvaluationBid';
import { Skeleton } from '@/components/ui/skeleton';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-80" />}>
      <EvaluationBid />
    </Suspense>
  );
}
