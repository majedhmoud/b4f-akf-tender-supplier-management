'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import { SupplierProfileForm } from '@/components/suppliers/SupplierProfileForm';
import { Skeleton } from '@/components/ui/skeleton';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSession } from '@/lib/useSession';

export function UserProfile() {
  const { session, isLoading, error, retry } = useSession();
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  // Account data uses the identity-scoped session query; no separate profile DTO is invented.
  // This redirect is for usability; API authorization remains authoritative (§12).
  useEffect(() => {
    if (!isLoading && !error && !session) {
      const query = search.toString();
      router.replace(
        { pathname: '/sign-in', query: { returnTo: pathname + (query ? '?' + query : '') } },
        { locale },
      );
    }
  }, [isLoading, error, session, pathname, search, router, locale]);
  if (error)
    return (
      <ErrorState
        title={t('Auth.sessionFailed')}
        action={<Button onClick={retry}>{t('Common.retry')}</Button>}
      />
    );
  if (isLoading || !session) return <Skeleton className="h-60 w-full" />;
  const { user } = session;
  return (
    <section className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('Profile.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('Profile.subtitle')}</p>
      </div>
      <dl className="divide-y divide-primary/20 rounded-md border border-primary/30 bg-card px-5">
        <div className="grid gap-2 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start sm:gap-5">
          <dt className="text-sm font-medium text-foreground">{t('Profile.email')}</dt>
          <dd dir="ltr" className="min-w-0 break-all text-start font-medium">
            {user.email}
          </dd>
        </div>
        <div className="grid gap-2 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start sm:gap-5">
          <dt className="text-sm font-medium text-foreground">{t('Profile.roles')}</dt>
          <dd>
            {user.roles.length ? (
              <ul className="flex flex-wrap gap-2">
                {user.roles.map((role) => (
                  <li
                    key={role}
                    className="rounded-md border border-primary/25 bg-secondary px-3 py-1 text-sm font-medium text-primary"
                  >
                    {t(`Profile.role.${role}`)}
                  </li>
                ))}
              </ul>
            ) : (
              t('Profile.noRoles')
            )}
          </dd>
        </div>
        <div className="grid gap-2 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start sm:gap-5">
          <dt className="text-sm font-medium text-foreground">{t('Profile.language')}</dt>
          <dd className="font-medium">{t(`Profile.${user.preferredLanguage}`)}</dd>
        </div>
      </dl>
      {/* Suppliers keep their company information on this same page. */}
      {user.roles.includes('supplier') && <SupplierProfileForm />}
    </section>
  );
}
