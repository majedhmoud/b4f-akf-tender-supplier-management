import { createContext, useContext, useState, type ReactNode } from 'react';
import { messages, type Locale } from './messages';

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggle: () => void;
} | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() =>
    Intl.DateTimeFormat().resolvedOptions().locale.startsWith('ar')
      ? 'ar'
      : 'en',
  );
  return (
    <LocaleContext.Provider
      value={{
        locale,
        setLocale,
        toggle: () => setLocale((l) => (l === 'ar' ? 'en' : 'ar')),
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('LocaleProvider is required');
  return { ...context, copy: messages[context.locale] };
}
