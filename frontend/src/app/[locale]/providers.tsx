'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { SetupLocaleProvider } from '@/components/account/SetupLocaleProvider';
import { SessionProvider } from '@/components/auth/SessionProvider';

// One query cache per browser tab. It is never persisted to browser storage.
// See API_CONTRACT.md §1.2.
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <SetupLocaleProvider>
        <Suspense fallback={null}>
          <SessionProvider>{children}</SessionProvider>
        </Suspense>
      </SetupLocaleProvider>
    </QueryClientProvider>
  );
}
