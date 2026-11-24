import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { IdempotencyModule } from '../idempotency/idempotency.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { MyBidsController, TenderBidsController } from './bids.controller.js';
import { BidAccessGuard } from './bid-access.guard.js';
import { BidsService } from './bids.service.js';

@Module({
  imports: [AuthModule, AuditModule, IdempotencyModule, StorageModule],
  controllers: [TenderBidsController, MyBidsController],
  providers: [BidsService, BidAccessGuard],
})
export class BidsModule {}
