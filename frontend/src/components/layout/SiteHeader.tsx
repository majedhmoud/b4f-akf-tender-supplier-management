'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import logo from '@/components/ui/assets/logo-transparent.png';
import { Link, usePathname } from '@/i18n/navigation';
import { useSession } from '@/lib/useSession';
import { LanguageSwitch } from './LanguageSwitch';

export function SiteHeader() {
  const t = useTranslations();
  const pathname = usePathname();
  const { session, isLoading, signOut } = useSession();
  const legalOnly =
    session?.user.roles.length === 1 && session.user.roles.includes('legal_committee');
  const user = session?.user;
  const accountLabel = user?.roles.includes('supplier')
    ? user.email
    : user?.displayName || user?.email;
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    setFailed(false);
    try {
      await signOut();
    } catch {
      setFailed(true);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="z-50 shrink-0 border-b border-border bg-card">
      <div className="flex min-h-16 w-full flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:py-0">
        <Link
          href={legalOnly ? '/signup-reviews' : '/'}
          className="inline-flex min-w-0 items-end gap-2 justify-self-start rounded-md text-lg font-bold tracking-tight text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <Image
            src={logo}
            alt=""
            width={135}
            height={275}
            className="h-10 w-auto object-contain"
          />
          <span>{t('Common.appName')}</span>
        </Link>
        {!session && (
          <nav
            aria-label={t('Nav.main')}
            className="order-last flex w-full flex-wrap items-center gap-x-5 gap-y-2 md:order-none md:col-start-2 md:w-auto md:self-stretch"
          >
            <Link
              href="/tenders"
              aria-current={pathname.startsWith('/tenders') ? 'page' : undefined}
              className="min-h-10 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-primary aria-[current=page]:font-semibold aria-[current=page]:text-primary md:flex md:items-center"
            >
              {t('Nav.tenders')}
            </Link>
            {!isLoading && (
              <Link
                href="/supplier-application"
                aria-current={pathname === '/supplier-application' ? 'page' : undefined}
                className="flex min-h-10 items-center rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-primary aria-[current=page]:font-semibold aria-[current=page]:text-primary md:min-h-16"
              >
                {t('Signup.apply')}
              </Link>
            )}
          </nav>
        )}
        <div className="ms-auto flex min-w-0 items-center justify-end gap-2 text-sm sm:gap-3 md:col-start-3">
          <Suspense fallback={null}>
            <LanguageSwitch />
          </Suspense>
          {!isLoading &&
            (session ? (
              <>
                <Link
                  href="/profile"
                  aria-label={`${t('Nav.profile')}: ${accountLabel}`}
                  title={accountLabel}
                  aria-current={pathname === '/profile' ? 'page' : undefined}
                  dir="auto"
                  className="inline-flex min-h-10 max-w-36 min-w-0 items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-primary sm:max-w-72 transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=page]:border-primary aria-[current=page]:bg-secondary"
                >
                  <span className="truncate">{accountLabel}</span>
                </Link>
                <Button
                  variant="outline"
                  className="bg-card"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  {t('Auth.signOut')}
                </Button>
              </>
            ) : (
              <Link
                href="/sign-in"
                aria-current={pathname === '/sign-in' ? 'page' : undefined}
                className="inline-flex min-h-10 items-center rounded-md border border-input bg-card px-4 py-2 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=page]:border-primary aria-[current=page]:bg-secondary"
              >
                {t('Auth.title')}
              </Link>
            ))}
        </div>
        {failed && (
          <p role="alert" className="w-full pb-3 text-sm text-destructive md:col-span-full">
            {t('Auth.signOutFailed')}
          </p>
        )}
      </div>
    </header>
  );
}
