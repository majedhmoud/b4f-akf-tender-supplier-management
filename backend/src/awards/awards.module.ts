import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { IdempotencyModule } from '../idempotency/idempotency.module.js';
import { AwardsController } from './awards.controller.js';
import { AwardsService } from './awards.service.js';

@Module({
  imports: [AuthModule, AuditModule, IdempotencyModule],
  controllers: [AwardsController],
  providers: [AwardsService],
  exports: [AwardsService],
})
export class AwardsModule {}
