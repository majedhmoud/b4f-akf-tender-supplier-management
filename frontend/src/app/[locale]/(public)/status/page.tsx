import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { ApiStatus } from '@/components/system/ApiStatus';

// Shows whether the API and its database answer. Useful when running locally.
export default function StatusPage({ params }: PageProps<'/[locale]/status'>) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return (
    <div className="max-w-xl">
      <ApiStatus />
    </div>
  );
}
