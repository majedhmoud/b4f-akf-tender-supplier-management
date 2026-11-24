'use client';

import { useContext } from 'react';
import { SessionContext } from '@/components/auth/SessionProvider';

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession requires SessionProvider');
  return session;
}
