import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

// The audited actions agreed in ENGINEERING_STANDARDS.md §8. Add one only when
// a workflow adds it.
export type AuditAction =
  | 'draft_tender.created'
  | 'draft_tender.accepted'
  | 'tender.published'
  | 'tender.closed'
  | 'tender.under_evaluation'
  | 'evaluation.submitted'
  | 'ranking.calculated'
  | 'tender.awarded'
  | 'tie.broken'
  | 'supplier_application.submitted'
  | 'signup_review.decided'
  | 'signup_request.accepted'
  | 'supplier_account.created'
  | 'employee_account.created'
  | 'account_setup_link.sent'
  | 'account.password_set'
  | 'supplier.legal_information_changed'
  | 'supplier.suspended'
  | 'supplier.reactivated'
  | 'supplier.certificate_replaced'
  | 'committee.raised'
  | 'committee_member.approved'
  | 'bid_part.submitted'
  | 'bid_part.replaced';

export interface AuditEventInput {
  actorUserId: string | null;
  action: AuditAction;
  resourceType:
    | 'tender'
    | 'supplier_application'
    | 'user_account'
    | 'supplier'
    | 'committee_assignment'
    | 'bid';
  resourceId: string;
  context?: Prisma.InputJsonValue;
  requestId?: string;
}

// Append-only: there is no update or delete. Every module records audit
// events through this service, inside the same transaction as the change it
// records.
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: AuditEventInput, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    return tx.auditEvent.create({ data: input });
  }
}
