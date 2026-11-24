import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Geist, Geist_Mono, Noto_Sans_Arabic } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { routing } from '@/i18n/routing';
import { Providers } from './providers';
import '../globals.css';

// Geist for Latin text, Noto Sans Arabic for Arabic. See ENGINEERING_STANDARDS.md §12.
const geist = Geist({ subsets: ['latin'], variable: '--font-latin' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });
const notoArabic = Noto_Sans_Arabic({ subsets: ['arabic'], variable: '--font-arabic' });

export const metadata: Metadata = {
  title: 'AKF Tender and Supplier Management',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Arabic pages run right to left. See V1_SCOPE.md.
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const footer = await getTranslations({ locale, namespace: 'PublicInfo' });

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geist.variable} ${geistMono.variable} ${notoArabic.variable}`}
    >
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <Suspense
          // Outside the translations provider, so the status text is chosen here.
          fallback={
            <div className="min-h-screen animate-pulse bg-muted" aria-busy="true">
              <span role="status" className="sr-only">
                {locale === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}
              </span>
            </div>
          }
        >
          <NextIntlClientProvider>
            <Providers>
              <AppShell>{children}</AppShell>
            </Providers>
          </NextIntlClientProvider>
        </Suspense>
        <footer className="mt-auto border-t border-border">
          <nav
            aria-label={footer('navigation')}
            className="mx-auto flex max-w-portal flex-wrap gap-x-5 gap-y-2 px-4 py-4 text-sm sm:px-6"
          >
            <Link href={`/${locale}/about`} className="text-muted-foreground hover:underline">
              {footer('about')}
            </Link>
            <Link href={`/${locale}/terms`} className="text-muted-foreground hover:underline">
              {footer('terms')}
            </Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
