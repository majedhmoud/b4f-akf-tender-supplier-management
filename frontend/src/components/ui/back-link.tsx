import type { ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

// The one style for "back" navigation: an outline button with an arrow that
// points the way back, so it reads as an action rather than plain text. The
// arrow flips in right-to-left pages.
export function BackLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={cn(
        'inline-flex min-h-10 w-fit items-center gap-2 self-start rounded-md border border-input bg-card px-3 py-2 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
    >
      <span aria-hidden="true" className="inline-block rtl:rotate-180">
        ←
      </span>
      {children}
    </Link>
  );
}
