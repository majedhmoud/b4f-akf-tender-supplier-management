import * as SecureStore from 'expo-secure-store';
import { apiOrigin } from '@/config/env';

const options = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
let pending: Promise<unknown> = Promise.resolve();

function ordered<T>(action: (key: string) => Promise<T>): Promise<T> {
  // Isolate credentials by origin and serialize writes with sign-out deletion.
  const operation = pending.then(() => {
    const key =
      'akf.refresh.' +
      Array.from(apiOrigin(), (char) => char.charCodeAt(0).toString(16)).join(
        '',
      );
    return action(key);
  });
  pending = operation.catch(() => undefined);
  return operation;
}

export const readRefreshToken = () =>
  ordered((key) => SecureStore.getItemAsync(key, options));
export const saveRefreshToken = (token: string) =>
  ordered((key) => SecureStore.setItemAsync(key, token, options));
export const clearRefreshToken = () =>
  ordered((key) => SecureStore.deleteItemAsync(key, options));
