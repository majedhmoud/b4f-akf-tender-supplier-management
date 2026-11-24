// The seed deletes and recreates demo data, so it refuses to run against
// anything but a database on this machine (CODING_STANDARDS.md §2.6).
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function assertLocalDatabase(databaseUrl: string | undefined): void {
  if (!databaseUrl) throw new Error('DATABASE_URL is not set.');
  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to seed: DATABASE_URL points at "${host}", not a local database. ` +
        'The seed deletes demo data and must only run on your own machine.',
    );
  }
}
