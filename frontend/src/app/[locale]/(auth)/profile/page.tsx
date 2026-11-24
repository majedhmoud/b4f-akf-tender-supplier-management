import { Suspense } from 'react';
import { UserProfile } from '@/components/account/UserProfile';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfilePage() {
  return (
    <Suspense fallback={<Skeleton className="h-60" />}>
      <UserProfile />
    </Suspense>
  );
}
