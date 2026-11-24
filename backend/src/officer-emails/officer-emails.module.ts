import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { OfficerEmailController, TenderEmailsController } from './officer-emails.controller.js';
import { OfficerEmailsService } from './officer-emails.service.js';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [TenderEmailsController, OfficerEmailController],
  providers: [OfficerEmailsService],
})
export class OfficerEmailsModule {}
