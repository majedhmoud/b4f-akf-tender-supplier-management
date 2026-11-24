'use client';

import { useEffect, useState } from 'react';
import { serverNow, syncServerClock } from './api/mutator';

// The current server time, updated every 30 seconds. Countdowns use it, never
// the device clock (API_CONTRACT.md §1.1). Null until the clock is loaded.
export function useServerNow(): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    syncServerClock()
      .catch(() => undefined)
      .finally(() => {
        if (active) setNow(serverNow());
      });
    const timer = window.setInterval(() => setNow(serverNow()), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return now;
}
