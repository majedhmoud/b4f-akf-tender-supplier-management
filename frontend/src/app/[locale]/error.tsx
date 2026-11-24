'use client';

import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';

// Shown when a page fails to render. Never shows the error's message.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations();

  return (
    <ErrorState
      title={t('Errors.genericTitle')}
      hint={t('Errors.genericHint')}
      action={
        <Button variant="outline" size="sm" onClick={reset}>
          {t('Common.retry')}
        </Button>
      }
    />
  );
}
