// Query keys from API_CONTRACT.md §1.2. Public data is keyed by locale, so a
// language switch never shows the other language from the cache. Private data
// is keyed by the signed-in user, so one user never sees another's cache.

export function publicKey(locale: string, key: readonly unknown[]): readonly unknown[] {
  return ['public', locale, ...key];
}

export function privateKey(userId: string, key: readonly unknown[]): readonly unknown[] {
  return ['me', userId, ...key];
}
