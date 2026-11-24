import { Module } from '@nestjs/common';
import { SetupTokensModule } from '../account-setup/setup-tokens.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { IdempotencyModule } from '../idempotency/idempotency.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { GuestApplicationGuard } from './guest-application.guard.js';
import {
  LegalApplicationsController,
  SignupFormController,
  SignupRequestsController,
  SignupReviewsController,
  SupplierApplicationsController,
} from './supplier-sign-up.controller.js';
import { SupplierSignUpService } from './supplier-sign-up.service.js';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    IdempotencyModule,
    StorageModule,
    SetupTokensModule,
    NotificationsModule,
  ],
  controllers: [
    SignupFormController,
    SupplierApplicationsController,
    LegalApplicationsController,
    SignupReviewsController,
    SignupRequestsController,
  ],
  providers: [GuestApplicationGuard, SupplierSignUpService],
})
export class SupplierSignUpModule {}
