'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { authGetSession, useAuthGetSession, useAuthSignOut } from '@/lib/api/generated/auth/auth';
import type { SessionView } from '@/lib/api/generated/model/sessionView';
import {
  advanceSessionGeneration,
  ApiError,
  onSessionEnded,
  resetCsrfToken,
  syncServerClock,
} from '@/lib/api/mutator';
import { isPrivatePath } from '@/lib/authNavigation';
import { privateKey } from '@/lib/api/query-keys';

type SessionState = {
  session: SessionView | null;
  isLoading: boolean;
  error: unknown;
  establish: (session: SessionView) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
};
export const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const locale = useLocale();
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const epoch = useRef(0);
  const transitioning = useRef(false);
  const knownUser = useRef(false);
  const query = useAuthGetSession({
    query: {
      queryKey: privateKey(userId ?? '', ['session']),
      enabled: !!userId,
      retry: false,
      staleTime: 30_000,
    },
  });
  const signOutMutation = useAuthSignOut();

  const clearSession = useCallback(async () => {
    epoch.current += 1;
    knownUser.current = false;
    advanceSessionGeneration();
    await queryClient.cancelQueries();
    queryClient.clear();
    resetCsrfToken();
    setUserId(null);
    setLoading(false);
  }, [queryClient]);

  useEffect(
    () =>
      onSessionEnded(() => {
        if (transitioning.current || (!knownUser.current && !isPrivatePath(pathname))) return;
        transitioning.current = true;
        const returnTo = window.location.pathname + window.location.search;
        void clearSession().then(() => {
          router.replace({ pathname: '/sign-in', query: { returnTo } }, { locale });
          transitioning.current = false;
          void syncServerClock().catch(() => {});
        });
      }),
    [clearSession, locale, pathname, router],
  );

  useEffect(() => {
    const controller = new AbortController();
    const generation = epoch.current;
    // Discover identity without putting a session into a shared query key.
    // Once known, all session reads use privateKey(userId, …), per §1.2.
    void authGetSession({ signal: controller.signal })
      .then((session) => {
        if (controller.signal.aborted || generation !== epoch.current) return;
        knownUser.current = true;
        queryClient.setQueryData(privateKey(session.user.id, ['session']), session);
        setUserId(session.user.id);
        setBootstrapError(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && generation === epoch.current) {
          setBootstrapError(
            error instanceof ApiError && ['UNAUTHENTICATED', 'SESSION_REVOKED'].includes(error.code)
              ? null
              : error,
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && generation === epoch.current) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt, queryClient]);

  async function establish(session: SessionView) {
    transitioning.current = true;
    try {
      await clearSession();
      knownUser.current = true;
      queryClient.setQueryData(privateKey(session.user.id, ['session']), session);
      setUserId(session.user.id);
      setBootstrapError(null);
      await syncServerClock();
    } finally {
      transitioning.current = false;
    }
  }

  async function signOut() {
    transitioning.current = true;
    try {
      try {
        await signOutMutation.mutateAsync();
      } catch (error) {
        if (
          !(error instanceof ApiError) ||
          !['UNAUTHENTICATED', 'SESSION_REVOKED'].includes(error.code)
        )
          throw error;
      }
      await clearSession();
      await syncServerClock();
      router.replace('/tenders', { locale });
    } finally {
      transitioning.current = false;
    }
  }

  return (
    <SessionContext.Provider
      value={{
        session: userId ? (query.data ?? null) : null,
        isLoading: isLoading || (!!userId && query.isPending),
        error: bootstrapError || query.error,
        establish,
        signOut,
        retry: () => {
          setLoading(true);
          setBootstrapError(null);
          setAttempt((value) => value + 1);
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
