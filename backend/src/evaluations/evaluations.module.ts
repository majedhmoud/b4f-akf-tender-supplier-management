import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import {
  FinancialEvaluationsController,
  LegalEvaluationsController,
  TechnicalEvaluationsController,
} from './evaluations.controller.js';
import { EvaluationsService } from './evaluations.service.js';

@Module({
  imports: [AuthModule, AuditModule, StorageModule],
  controllers: [
    LegalEvaluationsController,
    TechnicalEvaluationsController,
    FinancialEvaluationsController,
  ],
  providers: [EvaluationsService],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
