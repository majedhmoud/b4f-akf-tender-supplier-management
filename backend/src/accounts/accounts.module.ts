import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccountsService } from './accounts.service.js';
import { MeController } from './me.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [MeController],
  providers: [AccountsService],
})
export class AccountsModule {}
