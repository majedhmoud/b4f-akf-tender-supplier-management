'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePathname, useRouter } from '@/i18n/navigation';
import { staffRoleForPath } from '@/lib/authNavigation';
import { useSession } from '@/lib/useSession';

// Redirects are usability guards. The API owns all authorization (§12).
export function StaffGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading, error, retry } = useSession();
  const pathname = usePathname();
  const search = useSearchParams();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations();
  const role = staffRoleForPath(pathname);
  const allowed = !!role && (session?.user.roles.includes(role) ?? false);

  useEffect(() => {
    if (!isLoading && !error && !allowed) {
      const query = search.toString();
      router.replace(
        { pathname: '/sign-in', query: { returnTo: pathname + (query ? '?' + query : '') } },
        { locale },
      );
    }
  }, [isLoading, error, allowed, pathname, search, locale, router]);

  if (error)
    return (
      <ErrorState
        title={t('Auth.sessionFailed')}
        action={<Button onClick={retry}>{t('Common.retry')}</Button>}
      />
    );
  if (isLoading || !allowed) return <Skeleton className="h-32 w-full" />;
  return children;
}
