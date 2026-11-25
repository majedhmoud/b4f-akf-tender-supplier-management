'use client';

import { Suspense } from 'react';
import { useSession } from '@/lib/useSession';
import { AppSidebar } from './AppSidebar';
import { SiteHeader } from './SiteHeader';

export function AppShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { session } = useSession();
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SiteHeader />
      <div
        // Signed in, the sidebar sits at the screen's start edge (right in
        // Arabic); only the main content keeps the page width.
        className={
          session
            ? 'flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]'
            : 'flex min-h-0 flex-1 flex-col'
        }
      >
        <Suspense fallback={null}>
          <AppSidebar />
        </Suspense>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col">
            {/* Always render the route segment, including during session discovery. */}
            <main className="mx-auto w-full min-w-0 max-w-portal px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
              {children}
            </main>
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}
