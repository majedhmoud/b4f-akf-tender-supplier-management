import { Suspense } from 'react';
import { TenderDetailFromRoute } from '@/components/tenders/TenderDetail';
import { Skeleton } from '@/components/ui/skeleton';

// The detail loads in the browser through the API, so the page shell is
// static; the tender id is read from the route on the client, inside Suspense
// as Next.js Cache Components requires.
export default function TenderPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <TenderDetailFromRoute />
    </Suspense>
  );
}
