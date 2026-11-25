'use client';

import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

// A visually hidden loading status for screen readers (ADR 0008, rule 2).
export function LoadingStatus({ label }: { label?: string }) {
  const t = useTranslations('Common');
  return (
    <span role="status" className="sr-only">
      {label ?? t('loading')}
    </span>
  );
}

// Placeholders shaped like list cards: title, details, status and action.
export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3" aria-busy="true">
      <LoadingStatus />
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="panel space-y-3 p-4" aria-hidden="true">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

// A page-sized placeholder with the status, for route loading boundaries.
export function PageSkeleton({ className = 'h-32 w-full' }: { className?: string }) {
  return (
    <div aria-busy="true">
      <LoadingStatus />
      <Skeleton className={className} />
    </div>
  );
}
