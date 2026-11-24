import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { BidFormService } from './bid-form.service.js';
import { EmployeeTendersController } from './employee-tenders.controller.js';
import { EmployeeTendersService } from './employee-tenders.service.js';
import { ManageTendersController } from './manage-tenders.controller.js';
import { ManagedTendersService } from './managed-tenders.service.js';
import { PublicTendersController } from './public-tenders.controller.js';
import { PublicTendersService } from './public-tenders.service.js';
import { TenderDocumentsService } from './tender-documents.service.js';

// Tenders module (ENGINEERING_STANDARDS.md §1.1, slice S1).
@Module({
  imports: [AuthModule, AuditModule, StorageModule],
  controllers: [PublicTendersController, EmployeeTendersController, ManageTendersController],
  providers: [
    EmployeeTendersService,
    ManagedTendersService,
    TenderDocumentsService,
    BidFormService,
    PublicTendersService,
  ],
})
export class TendersModule {}
