import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import type { BidFormEditorView, ManagedTender } from '@/lib/api/generated/model';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';

export const tender: ManagedTender = {
  id: 't-1',
  status: 'accepted',
  revision: 5,
  categoryCode: 'construction',
  requestedBy: { id: 'u-2', name: 'Lina' },
  estimatedBalance: { amount: '1000.00', currency: 'USD' },
  translations: [{ language: 'en', title: 'School repairs', description: 'Repair the roof.' }],
  scoring: { technicalWeight: 70, financialWeight: 30, minimumTechnicalScore: 60 },
  deadlines: null,
  documents: [],
  copiedFromTenderId: null,
  copiedIntoTenderId: null,
  cancellationReason: null,
  allowedActions: ['edit', 'upload_terms_of_reference', 'publish', 'raise_committee'],
};
export const form: BidFormEditorView = {
  revision: 5,
  allowedActions: ['save'],
  parts: [
    {
      partType: 'legal_information',
      fields: [{ name: 'authorizedSignatoryName', type: 'text', required: true, maxLength: 120 }],
      documents: [{ kind: 'registration_certificate', required: true }],
      customFields: [],
    },
    {
      partType: 'technical_offer',
      fields: [],
      documents: [{ kind: 'technical_proposal', required: true }],
      customFields: [],
    },
    {
      partType: 'financial_offer',
      fields: [],
      documents: [{ kind: 'financial_proposal', required: true }],
      customFields: [],
    },
  ],
};
export function ManagementTestProvider({
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
