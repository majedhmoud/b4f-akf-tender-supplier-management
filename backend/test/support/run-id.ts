import { randomUUID } from 'node:crypto';

// A suffix for every fixture a test file creates. Test files run in parallel
// against the same local database, so a timestamp alone can collide.
export function uniqueRunId(): string {
  return `${Date.now()}-${randomUUID().slice(0, 8)}`;
}
