import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AccountSetupController } from './account-setup.controller.js';
import { AccountSetupService } from './account-setup.service.js';
import { SetupTokensModule } from './setup-tokens.module.js';

@Module({
  imports: [AuthModule, AuditModule, NotificationsModule, SetupTokensModule],
  controllers: [AccountSetupController],
  providers: [AccountSetupService],
})
export class AccountSetupModule {}
