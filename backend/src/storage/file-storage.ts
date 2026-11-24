import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, type ReadStream } from 'node:fs';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';

// Storage keys are random and server-generated (ERD, Document ownership).
const KEY_PATTERN = /^[A-Za-z0-9_-]{32}$/;

function newKey(): string {
  return randomBytes(24).toString('base64url');
}

// Local-disk file storage for the hackathon (ADR 0006). Modules call only
// these methods and never touch paths, so moving to object storage before a
// deployment replaces this class alone.
@Injectable()
export class FileStorage {
  private readonly root: string;

  constructor(config: ConfigService) {
    const dir = config.get<string>('FILE_STORAGE_DIR', 'storage');
    this.root = isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
  }

  // Never builds a path from anything but a validated, server-generated key.
  private pathOf(key: string): string {
    if (!KEY_PATTERN.test(key)) throw new Error('Invalid storage key');
    return join(this.root, key);
  }

  async save(content: Buffer): Promise<string> {
    await mkdir(this.root, { recursive: true });
    const key = newKey();
    await writeFile(this.pathOf(key), content, { flag: 'wx' });
    return key;
  }

  // A copy gets its own key and file (ERD, Copying a cancelled tender).
  async copy(key: string): Promise<string> {
    await mkdir(this.root, { recursive: true });
    const copyKey = newKey();
    await copyFile(this.pathOf(key), this.pathOf(copyKey));
    return copyKey;
  }

  read(key: string): ReadStream {
    return createReadStream(this.pathOf(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  isValidKey(key: string): boolean {
    return KEY_PATTERN.test(key);
  }
}
