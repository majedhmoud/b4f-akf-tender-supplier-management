import { defineRouting } from 'next-intl/routing';

// The interface languages. See API_CONTRACT.md §1.7: the locale comes from the route.
export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
});

export type Locale = (typeof routing.locales)[number];
