import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

// The single database client. Services inject it as `prisma`.
// See CODING_STANDARDS.md §2.3.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
        // Every session works in UTC, so timestamps read or written through raw
        // SQL are never shifted by the database server's local time zone.
        options: '-c TimeZone=UTC',
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
