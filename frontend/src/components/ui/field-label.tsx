'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

export function FieldLabel({
  children,
  optional = false,
}: {
  children: ReactNode;
  optional?: boolean;
}) {
  const t = useTranslations('Common');

  return (
    <>
      {children}
      {optional && (
        <>
          {' '}
          <span className="text-xs font-normal text-muted-foreground">({t('optional')})</span>
        </>
      )}
    </>
  );
}
