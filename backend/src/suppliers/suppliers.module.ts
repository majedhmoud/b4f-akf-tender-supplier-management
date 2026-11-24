import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { AdminSuppliersController, SupplierProfileController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';

@Module({
  imports: [AuthModule, AuditModule, StorageModule],
  controllers: [SupplierProfileController, AdminSuppliersController],
  providers: [SuppliersService],
})
export class SuppliersModule {}
