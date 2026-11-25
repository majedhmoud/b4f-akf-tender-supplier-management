'use client';

import { Suspense } from 'react';
import { useSession } from '@/lib/useSession';
import { AppSidebar } from './AppSidebar';
import { SiteHeader } from './SiteHeader';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div
        // Signed in, the sidebar sits at the screen's start edge (right in
        // Arabic); only the main content keeps the page width.
        className={
          session
            ? 'w-full lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]'
            : 'mx-auto w-full max-w-portal'
        }
      >
        <Suspense fallback={null}>
          <AppSidebar />
        </Suspense>
        {/* Always render the route segment, including during session discovery. */}
        <main className="mx-auto w-full min-w-0 max-w-portal px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
