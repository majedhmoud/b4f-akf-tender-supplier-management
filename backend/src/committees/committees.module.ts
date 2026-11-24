import { Module } from '@nestjs/common';
import { SetupTokensModule } from '../account-setup/setup-tokens.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EvaluationsModule } from '../evaluations/evaluations.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import {
  AdminNominationsController,
  MyAssignmentsController,
  NominationsController,
  TenderCommitteesController,
} from './committees.controller.js';
import { CommitteesService } from './committees.service.js';

@Module({
  imports: [AuthModule, AuditModule, SetupTokensModule, NotificationsModule, EvaluationsModule],
  controllers: [
    TenderCommitteesController,
    NominationsController,
    AdminNominationsController,
    MyAssignmentsController,
  ],
  providers: [CommitteesService],
})
export class CommitteesModule {}
