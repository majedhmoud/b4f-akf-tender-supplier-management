export function apiOrigin(): string {
  const url = new URL(
    process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
  );
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.pathname !== '/' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be an HTTP(S) origin.');
  }
  return url.origin;
}
