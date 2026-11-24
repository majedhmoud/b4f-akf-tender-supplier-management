import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { SignInForm } from './SignInForm';

export default function SignInPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-80 max-w-md" />}>
      <SignInForm />
    </Suspense>
  );
}
