import type { Locale } from '@/locale/messages';
import { postSession } from './client';

export type SupplierUser = { id: string; preferredLanguage: Locale };
export type DeviceSession = {
  accessToken: string;
  refreshToken: string;
  user: SupplierUser;
};

export const signInSupplier = (email: string, password: string) =>
  postSession<DeviceSession>('sign-in', { email, password });
export const refreshSupplier = (refreshToken: string) =>
  postSession<DeviceSession>('refresh', { refreshToken });
export const signOutSupplier = (refreshToken: string) =>
  postSession<void>('sign-out', { refreshToken });
