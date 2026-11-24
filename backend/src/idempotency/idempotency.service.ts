import { HttpStatus, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { ApiException } from '../common/errors/api-exception.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Saved = {
  payload_hash: string;
  response_status: number | null;
  response_body: Prisma.JsonValue | null;
  expires_at: Date;
};
const RESERVATION_HOURS = 24;
const WORK_TIMEOUT_MS = 20_000;
// A pending reservation older than this, whose row no transaction holds, was
// abandoned: its worker crashed or timed out, so it can never commit. Longer
// than the work timeout, so a live worker is never mistaken for a dead one.
const ABANDONED_AFTER_SECONDS = 60;
// The owner column of a key: constants only, never user input.
const GUEST = Prisma.raw('guest_scope_id');
const USER = Prisma.raw('user_id');

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  // API_CONTRACT.md §1.3 / ERD Supporting tables: reserve before acting,
  // then commit the business write and saved response together.
  guest<T extends Prisma.InputJsonObject>(
    scope: string,
    key: string | undefined,
    route: string,
    hash: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<{ body: T; replayed: boolean }> {
    return this.run(GUEST, scope, key, route, hash, work, 201);
  }

  // The same, for a signed-in user's write (B2, B4).
  user<T extends Prisma.InputJsonObject>(
    userId: string,
    key: string | undefined,
    route: string,
    hash: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    status = 201,
  ): Promise<{ body: T; replayed: boolean }> {
    return this.run(USER, userId, key, route, hash, work, status);
  }

  private async run<T extends Prisma.InputJsonObject>(
    owner: Prisma.Sql,
    scope: string,
    key: string | undefined,
    route: string,
    hash: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    status: number,
  ): Promise<{ body: T; replayed: boolean }> {
    if (!key || !isUUID(key))
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Invalid idempotency key',
        [{ field: 'Idempotency-Key', code: key ? 'INVALID' : 'REQUIRED' }],
      );
    const expires = new Date(Date.now() + RESERVATION_HOURS * 60 * 60 * 1000);
    // An active business transaction locks its reservation and cannot be
    // cleaned up. An old worker must match the reservation expiry below, so
    // it cannot later commit against a replacement reservation.
    await this.prisma.$executeRaw`
      WITH expired AS (
        SELECT ${owner} AS owner_id, route, key FROM idempotency_keys
        WHERE ${owner} = ${scope}::uuid AND route = ${route} AND key = ${key}::uuid AND expires_at <= NOW()
        FOR UPDATE SKIP LOCKED
      ) DELETE FROM idempotency_keys k USING expired e
      WHERE k.${owner}=e.owner_id AND k.route=e.route AND k.key=e.key`;
    let reserved: { expires_at: Date }[] = [];
    for (let attempt = 0; ; attempt += 1) {
      reserved = await this.prisma.$queryRaw<{ expires_at: Date }[]>`
      INSERT INTO idempotency_keys (${owner}, route, key, payload_hash, expires_at)
      VALUES (${scope}::uuid, ${route}, ${key}::uuid, ${hash}, ${expires})
      ON CONFLICT (${owner}, route, key) WHERE ${owner} IS NOT NULL DO NOTHING RETURNING expires_at`;
      if (!reserved.length) {
        const [saved] = await this.prisma.$queryRaw<
          Saved[]
        >`SELECT payload_hash, response_status, response_body, expires_at FROM idempotency_keys WHERE ${owner}=${scope}::uuid AND route=${route} AND key=${key}::uuid`;
        if (!saved) throw this.pending();
        if (saved.payload_hash !== hash)
          throw new ApiException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'IDEMPOTENCY_KEY_REUSED',
            'Different payload for key',
          );
        if (saved.response_status === null) {
          // ERD, Supporting tables: recover an abandoned reservation only once
          // it can no longer commit. Then reserve again, once.
          if (attempt === 0 && (await this.reclaimAbandoned(owner, scope, route, key))) continue;
          throw this.pending();
        }
        return { body: saved.response_body as T, replayed: true };
      }
      break;
    }
    try {
      const body = await this.prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<
            Saved[]
          >`SELECT payload_hash, response_status, response_body, expires_at FROM idempotency_keys WHERE ${owner}=${scope}::uuid AND route=${route} AND key=${key}::uuid AND expires_at=${reserved[0].expires_at} FOR UPDATE`;
          if (!rows.length || rows[0].response_status !== null) throw this.pending();
          const result = await work(tx);
          await tx.$executeRaw`UPDATE idempotency_keys SET response_status=${status}, response_body=${JSON.stringify(result)}::jsonb WHERE ${owner}=${scope}::uuid AND route=${route} AND key=${key}::uuid AND expires_at=${reserved[0].expires_at}`;
          return result;
        },
        { timeout: WORK_TIMEOUT_MS },
      );
      return { body, replayed: false };
    } catch (error) {
      // A completed response survives an uncertain acknowledgement. Only a
      // confirmed rolled-back, still-pending reservation is released.
      await this.prisma
        .$executeRaw`DELETE FROM idempotency_keys WHERE ${owner}=${scope}::uuid AND route=${route} AND key=${key}::uuid AND expires_at=${reserved[0].expires_at} AND response_status IS NULL`;
      throw error;
    }
  }
  // Deletes the reservation if it is pending, older than the abandonment age,
  // and not locked by a working transaction (which holds its row FOR UPDATE).
  private reclaimAbandoned(
    owner: Prisma.Sql,
    scope: string,
    route: string,
    key: string,
  ): Promise<boolean> {
    // Reserved before this moment means older than the abandonment age.
    const newestAbandonedExpiry = new Date(
      Date.now() + RESERVATION_HOURS * 3_600_000 - ABANDONED_AFTER_SECONDS * 1000,
    );
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ key: string }[]>`
        SELECT key FROM idempotency_keys
        WHERE ${owner}=${scope}::uuid AND route=${route} AND key=${key}::uuid
          AND response_status IS NULL
          AND expires_at <= ${newestAbandonedExpiry}
        FOR UPDATE SKIP LOCKED`;
      if (!rows.length) return false;
      // This transaction holds the row lock, so the key alone identifies it.
      const deleted =
        await tx.$executeRaw`DELETE FROM idempotency_keys WHERE ${owner}=${scope}::uuid AND route=${route} AND key=${key}::uuid AND response_status IS NULL`;
      return deleted === 1;
    });
  }

  private pending() {
    return new ApiException(
      HttpStatus.CONFLICT,
      'IDEMPOTENCY_IN_PROGRESS',
      'Retry with the same key after one second',
    );
  }
}
