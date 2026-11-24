import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthStatus } from './dto/health-status.dto.js';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  // The API answers even when the database is down, so the web app can show
  // which part is failing instead of a generic error.
  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
      return { status: 'ok', database: 'down' };
    }
  }
}
