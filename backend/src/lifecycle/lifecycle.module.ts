import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { LIFECYCLE_QUEUE, TenderLifecycle, TenderLifecycleWorker } from './tender-lifecycle.js';

@Module({
  imports: [BullModule.registerQueue({ name: LIFECYCLE_QUEUE }), AuditModule],
  providers: [TenderLifecycle, TenderLifecycleWorker],
  exports: [TenderLifecycle],
})
export class LifecycleModule {}
