import { Module } from '@nestjs/common';
import { SetupTokensModule } from '../account-setup/setup-tokens.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminEmployeesController } from './admin-employees.controller.js';
import { EmployeeAccountsService } from './employee-accounts.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { AccountsService } from './accounts.service.js';
import { MeController } from './me.controller.js';

@Module({
  imports: [AuthModule, AuditModule, SetupTokensModule, NotificationsModule],
  controllers: [MeController, AdminEmployeesController],
  providers: [AccountsService, EmployeeAccountsService],
})
export class AccountsModule {}
