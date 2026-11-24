'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePathname, useRouter } from '@/i18n/navigation';

// Evaluation access comes from assignments, not roles, so pages only need a
// session; the API decides the rest and answers 404 otherwise.
export function SignInRequired() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  useEffect(() => {
    router.replace({ pathname: '/sign-in', query: { returnTo: pathname } }, { locale });
  }, [router, pathname, locale]);
  return <Skeleton className="h-32" />;
}
