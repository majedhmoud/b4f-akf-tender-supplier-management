import type { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { FileStorage } from './file-storage.js';

// Deletes newly stored files that no saved document references. After an
// error the transaction may still have committed (a connection lost after
// COMMIT), so a file is removed only once the database confirms it is unused.
// If the database cannot be asked, the files stay: an orphan file is safer
// than a saved document without its file.
export async function discardUnreferenced(
  prisma: PrismaService,
  storage: FileStorage,
  keys: string[],
  logger: Logger,
): Promise<void> {
  if (!keys.length) return;
  let used: Set<string>;
  try {
    const rows = await prisma.document.findMany({
      where: { storageKey: { in: keys } },
      select: { storageKey: true },
    });
    used = new Set(rows.map((row) => row.storageKey));
  } catch {
    logger.warn(`Kept ${keys.length} uploaded file(s): their save could not be confirmed`);
    return;
  }
  await Promise.all(
    keys.filter((key) => !used.has(key)).map((key) => storage.delete(key).catch(() => undefined)),
  );
}
