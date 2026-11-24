import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import type {
  ApplicationPage,
  LegalApplicationView,
  SupplierApplicationForm,
} from '@/lib/api/generated/model';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';
export const application: LegalApplicationView = {
  applicationId: 'a-1',
  legalName: 'Al-Noor',
  registrationNumber: 'CR-1',
  contactEmail: 'supplier@example.test',
  preferredLanguage: 'ar',
  submittedAt: '2026-11-24T00:00:00Z',
  documents: [
    { id: 'd-1', kind: 'registration_certificate', name: 'Register.pdf', language: 'ar' },
  ],
};
export const page: ApplicationPage = {
  data: [application],
  meta: { page: 1, limit: 20, total: 21, totalPages: 2 },
};
export const form: SupplierApplicationForm = {
  fields: [
    { name: 'legalName', type: 'text', required: true, maxLength: 200 },
    { name: 'registrationNumber', type: 'text', required: true, maxLength: 100 },
    { name: 'contactEmail', type: 'email', required: true, maxLength: 254 },
    { name: 'preferredLanguage', type: 'enum', values: ['en', 'ar'], required: true },
  ],
  documents: [
    { kind: 'registration_certificate', required: true },
    { kind: 'tax_certificate', required: true },
  ],
};
export function SignupTestProvider({
  children,
  locale = 'en',
}: {
  children: React.ReactNode;
  locale?: 'en' | 'ar';
}) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}
