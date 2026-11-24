import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Shared empty and error states, so every data view handles both the same way
// (CODING_STANDARDS.md §3.4).

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-md border border-dashed border-input bg-card px-5 py-10 text-center text-muted-foreground">
      <p className="text-foreground font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm">{hint}</p>}
    </div>
  );
}

export function ErrorState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <Alert
      variant="destructive"
      role="alert"
      className="border-destructive/30 bg-destructive/5 px-4 py-3"
    >
      <AlertTitle>{title}</AlertTitle>
      {(hint || action) && (
        <AlertDescription>
          {hint}
          {action && <div className="mt-3">{action}</div>}
        </AlertDescription>
      )}
    </Alert>
  );
}
