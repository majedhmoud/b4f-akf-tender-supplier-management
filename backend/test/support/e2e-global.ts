import { Redis } from 'ioredis';

// Removes the test queues from Redis after the whole e2e run.
export async function teardown(): Promise<void> {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'test-*', 'COUNT', 500);
      if (keys.length) await redis.del(...keys);
      cursor = next;
    } while (cursor !== '0');
  } finally {
    redis.disconnect();
  }
}
