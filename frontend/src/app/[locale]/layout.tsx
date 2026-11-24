import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Geist, Geist_Mono, Noto_Sans_Arabic } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
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

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geist.variable} ${geistMono.variable} ${notoArabic.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Suspense
          fallback={<div className="min-h-screen animate-pulse bg-muted" aria-busy="true" />}
        >
          <NextIntlClientProvider>
            <Providers>
              <AppShell>{children}</AppShell>
            </Providers>
          </NextIntlClientProvider>
        </Suspense>
      </body>
    </html>
  );
}
