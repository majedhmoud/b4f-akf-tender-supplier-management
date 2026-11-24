'use client';

import { NextIntlClientProvider, useLocale } from 'next-intl';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';

type Locale = 'en' | 'ar';
const SetupLocaleContext = createContext<{
  locale: Locale;
  setLocale: Dispatch<SetStateAction<Locale | null>>;
} | null>(null);

// Setup must change language without remounting the page that holds its transient token.
export function SetupLocaleProvider({ children }: { children: React.ReactNode }) {
  const routeLocale = useLocale();
  const [override, setLocale] = useState<Locale | null>(null);
  const locale = override ?? (routeLocale === 'ar' ? 'ar' : 'en');
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);
  return (
    <SetupLocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en}>
        {children}
      </NextIntlClientProvider>
    </SetupLocaleContext.Provider>
  );
}

export function useSetupLocale() {
  return useContext(SetupLocaleContext);
}
