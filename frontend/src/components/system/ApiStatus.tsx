'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useHealthCheck } from '@/lib/api/generated/system/system';

// Shows whether the API and its database answer, through the generated client.
export function ApiStatus() {
  const t = useTranslations('Home');
  const { data, isPending, isError, refetch, isFetching } = useHealthCheck();

  return (
    <section className="rounded-md border p-4" aria-labelledby="api-status-heading">
      <h2 id="api-status-heading" className="mb-3 font-medium">
        {t('apiStatus')}
      </h2>

      {isPending && <p className="text-muted-foreground text-sm">{t('checking')}</p>}

      {isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('unreachable')}
        </p>
      )}

      {data && (
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt>{t('api')}</dt>
          <dd className="text-end">{t('up')}</dd>
          <dt>{t('database')}</dt>
          <dd className="text-end">{t(data.database)}</dd>
        </dl>
      )}

      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => refetch()}
        disabled={isFetching}
      >
        {t('retry')}
      </Button>
    </section>
  );
}
