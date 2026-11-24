'use client';

import { useCallback, useEffect, useRef } from 'react';

// Returns keyboard focus to the button that opened an inline confirmation,
// once it is cancelled or completed (ADR 0008, rule 5). A list can render the
// same trigger twice (table and cards), so the visible one receives focus.
export function useReturnFocus() {
  const triggers = useRef(new Map<string, HTMLElement>());
  const pending = useRef<string | null>(null);

  const register = useCallback(
    (layout: string, id: string) => (element: HTMLElement | null) => {
      const key = `${layout}:${id}`;
      if (element) triggers.current.set(key, element);
      else triggers.current.delete(key);
    },
    [],
  );

  const returnTo = useCallback((id: string) => {
    pending.current = id;
  }, []);

  useEffect(() => {
    const id = pending.current;
    if (!id) return;
    for (const [key, element] of triggers.current) {
      if (key.endsWith(`:${id}`) && element.offsetParent !== null) {
        element.focus();
        pending.current = null;
        return;
      }
    }
  });

  return { register, returnTo };
}
