'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/mutator';

// API_CONTRACT.md §1.3: unchanged retries keep their key; deliberate edits start a new action.
export function useBidAction() {
  const key = useRef<string | null>(null);
  const running = useRef(false);
  const waiting = useRef(false);
  const needsEdit = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function edited() {
    if (running.current) return;
    key.current = null;
    needsEdit.current = false;
    setBlocked(waiting.current);
  }
  function begin(): string | null {
    if (running.current || waiting.current || needsEdit.current) return null;
    running.current = true;
    setBusy(true);
    key.current ??= crypto.randomUUID();
    return key.current;
  }
  function failed(error: unknown) {
    if (!(error instanceof ApiError)) return;
    if (error.code === 'IDEMPOTENCY_KEY_REUSED') {
      needsEdit.current = true;
      setBlocked(true);
    }
    const delay =
      error.code === 'IDEMPOTENCY_IN_PROGRESS'
        ? 1000
        : error.code === 'RATE_LIMITED'
          ? error.retryAfterMs
          : 0;
    if (delay > 0) {
      if (timer.current) clearTimeout(timer.current);
      waiting.current = true;
      setBlocked(true);
      timer.current = setTimeout(() => {
        waiting.current = false;
        setBlocked(needsEdit.current);
      }, delay);
    }
  }
  function finish(succeeded = false) {
    if (succeeded) key.current = null;
    running.current = false;
    setBusy(false);
  }
  return { busy, blocked, edited, begin, failed, finish };
}
