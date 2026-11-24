import { useCallback, useEffect, useState } from 'react';

type Resource<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: unknown };

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [resource, setResource] = useState<Resource<T>>({ status: 'loading' });
  const retry = useCallback(() => {
    setResource({ status: 'loading' });
    setAttempt((current) => current + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResource({ status: 'ready', data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setResource({ status: 'error', error });
      },
    );
    return () => controller.abort();
  }, [attempt, load]);
  return { resource, retry };
}
