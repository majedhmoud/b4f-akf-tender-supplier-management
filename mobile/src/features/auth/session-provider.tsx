import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  refreshSupplier,
  signInSupplier,
  signOutSupplier,
  type DeviceSession,
  type SupplierUser,
} from '@/api/auth';
import { ApiError } from '@/api/client';
import { useLocale } from '@/locale/locale-provider';
import {
  clearRefreshToken,
  readRefreshToken,
  saveRefreshToken,
} from './credential-store';

type SessionState =
  | { status: 'restoring' | 'signedOut' | 'signingOut' }
  | { status: 'signedIn'; user: SupplierUser };

type SessionContext = {
  state: SessionState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<boolean>;
  withAccess: <T>(
    read: (token: string) => Promise<T>,
    signal: AbortSignal,
  ) => Promise<T>;
};

const Context = createContext<SessionContext | null>(null);
const unauthorized = () => new ApiError(401, 'UNAUTHENTICATED');

function sessionEnded(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 401 || error.code === 'ACCOUNT_DISABLED')
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { setLocale } = useLocale();
  const [state, setState] = useState<SessionState>({ status: 'restoring' });
  const current = useRef<DeviceSession | null>(null);
  const generation = useRef(0);
  const restoreStarted = useRef(false);
  const authBusy = useRef(false);
  const refreshInFlight = useRef<{
    epoch: number;
    operation: Promise<string>;
  } | null>(null);

  const endSession = useCallback(async () => {
    generation.current++;
    current.current = null;
    setState({ status: 'signedOut' });
    await clearRefreshToken().catch(() => undefined);
  }, []);

  const accept = useCallback(async (next: DeviceSession, epoch: number) => {
    if (epoch !== generation.current) throw unauthorized();
    try {
      await saveRefreshToken(next.refreshToken);
    } catch (error) {
      // A token that cannot be recovered securely must not leave an active device session.
      void signOutSupplier(next.refreshToken).catch(() => undefined);
      throw error;
    }
    if (epoch !== generation.current) throw unauthorized();
    current.current = next;
    return next;
  }, []);

  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;
    const epoch = generation.current;
    void (async () => {
      try {
        const token = await readRefreshToken();
        if (!token) {
          setState({ status: 'signedOut' });
          return;
        }
        const next = await accept(await refreshSupplier(token), epoch);
        setLocale(next.user.preferredLanguage);
        setState({ status: 'signedIn', user: next.user });
      } catch {
        if (epoch === generation.current) await endSession();
      }
    })();
  }, [accept, endSession, setLocale]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (authBusy.current || current.current) return;
      authBusy.current = true;
      const epoch = ++generation.current;
      try {
        const next = await accept(await signInSupplier(email, password), epoch);
        setLocale(next.user.preferredLanguage);
        setState({ status: 'signedIn', user: next.user });
      } finally {
        authBusy.current = false;
      }
    },
    [accept, setLocale],
  );

  const signOut = useCallback(async () => {
    if (authBusy.current) return false;
    authBusy.current = true;
    const session = current.current;
    generation.current++;
    current.current = null;
    setState({ status: 'signingOut' });
    const [storage, server] = await Promise.allSettled([
      clearRefreshToken(),
      session ? signOutSupplier(session.refreshToken) : Promise.resolve(),
    ]);
    authBusy.current = false;
    setState({ status: 'signedOut' });
    return storage.status === 'fulfilled' && server.status === 'fulfilled';
  }, []);

  const refreshAccess = useCallback(
    (epoch: number, expiredToken: string) => {
      const session = current.current;
      if (!session || generation.current !== epoch)
        return Promise.reject(unauthorized());
      if (session.accessToken !== expiredToken)
        return Promise.resolve(session.accessToken);
      if (refreshInFlight.current?.epoch === epoch)
        return refreshInFlight.current.operation;
      const operation = (async () => {
        try {
          const next = await accept(
            await refreshSupplier(session.refreshToken),
            epoch,
          );
          return next.accessToken;
        } catch (error) {
          // Rotation may have committed even if the response was lost. Never retry the old token.
          if (generation.current === epoch) {
            void signOutSupplier(session.refreshToken).catch(() => undefined);
            await endSession();
          }
          throw error;
        }
      })();
      refreshInFlight.current = { epoch, operation };
      const clear = () => {
        if (refreshInFlight.current?.operation === operation)
          refreshInFlight.current = null;
      };
      void operation.then(clear, clear);
      return operation;
    },
    [accept, endSession],
  );

  const withAccess = useCallback(
    async <T,>(
      read: (token: string) => Promise<T>,
      signal: AbortSignal,
    ): Promise<T> => {
      const epoch = generation.current;
      const token = current.current?.accessToken;
      if (!token || signal.aborted) throw unauthorized();
      try {
        let result: T;
        try {
          result = await read(token);
        } catch (error) {
          if (
            !(error instanceof ApiError) ||
            error.code !== 'SESSION_EXPIRED' ||
            signal.aborted
          )
            throw error;
          const replacement = await refreshAccess(epoch, token);
          if (generation.current !== epoch || signal.aborted)
            throw unauthorized();
          result = await read(replacement);
        }
        if (generation.current !== epoch || signal.aborted)
          throw unauthorized();
        return result;
      } catch (error) {
        if (
          !signal.aborted &&
          generation.current === epoch &&
          sessionEnded(error)
        ) {
          await endSession();
        }
        throw error;
      }
    },
    [endSession, refreshAccess],
  );

  return (
    <Context.Provider value={{ state, signIn, signOut, withAccess }}>
      {children}
    </Context.Provider>
  );
}

export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider is required');
  return value;
}
