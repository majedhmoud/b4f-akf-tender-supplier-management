import { HttpStatus, Injectable } from '@nestjs/common';
import { SetupTokens } from '../account-setup/setup-tokens.js';
import { AccessService, notFound } from '../auth/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ApiException, type ErrorCode } from '../common/errors/api-exception.js';
import { validateBody } from '../common/errors/validate-body.js';
import { pickTranslation } from '../common/language/language.js';
import { pageArgs, pageMeta, type PageQueryDto } from '../common/pagination/pagination.js';
import {
  Prisma,
  type CommitteeType,
  type Language,
  type TenderStatus,
} from '../generated/prisma/client.js';
import { EvaluationsService } from '../evaluations/evaluations.service.js';
import { EmailQueue } from '../notifications/email-queue.js';
import { committeeSetupEmail } from '../notifications/email-templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { statusChanged } from '../tenders/tender-rules.js';
import {
  ApproveNominationDto,
  NominateDto,
  RaiseCommitteeDto,
  type AdminNominationPage,
  type AssignmentPage,
  type CommitteePage,
  type CommitteeRaised,
  type NominationCreated,
  type NominationDecision,
} from './dto/committee.dto.js';

// Committees can be raised and staffed only before evaluation starts (C2, C3, C6).
const STAFFING: TenderStatus[] = ['accepted', 'published', 'closed'];

function conflict(code: ErrorCode, message: string): ApiException {
  return new ApiException(HttpStatus.CONFLICT, code, message);
}
const oneCommittee = () =>
  conflict('ASSIGNMENT_ONE_COMMITTEE_PER_TENDER', 'Already on a committee of this tender');
// Signals that another approval created the nominee's account first.
class AccountRace extends Error {}

const decided = () => conflict('ASSIGNMENT_ALREADY_DECIDED', 'Nomination already decided');

const titleSelect = { translations: { select: { language: true, title: true } } } as const;
function title(
  translations: { language: Language; title: string }[],
  language: Language,
): { language: Language; title: string } {
  const { content } = pickTranslation(translations, language);
  return { language: content.language, title: content.title };
}

// S3 Committees: C1–C7 in API_CONTRACT.md. The procurement_officer raises
// committees and nominates; the admin approves, which creates or links the
// member's account (ERD, Committees).
@Injectable()
export class CommitteesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly tokens: SetupTokens,
    private readonly emails: EmailQueue,
    private readonly evaluations: EvaluationsService,
  ) {}

  // C1.
  async list(tenderId: string, query: PageQueryDto): Promise<CommitteePage> {
    await this.access.managedTender(tenderId);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tenderCommittee.findMany({
        where: { tenderId },
        ...pageArgs(query),
        orderBy: [{ raisedAt: 'asc' }, { id: 'asc' }],
        select: {
          type: true,
          raisedAt: true,
          assignments: {
            orderBy: [{ nominatedAt: 'asc' }, { id: 'asc' }],
            select: { id: true, nomineeName: true, status: true },
          },
        },
      }),
      this.prisma.tenderCommittee.count({ where: { tenderId } }),
    ]);
    return {
      data: rows.map((row) => ({
        type: row.type,
        raisedAt: row.raisedAt.toISOString(),
        nominations: row.assignments,
      })),
      meta: pageMeta(query, total),
    };
  }

  // C2: repeating it returns the same committee (created = false).
  async raise(
    tenderId: string,
    officerId: string,
    body: unknown,
    requestId?: string,
  ): Promise<{ created: boolean; body: CommitteeRaised }> {
    await this.access.managedTender(tenderId);
    const view = (row: { type: CommitteeType; raisedAt: Date }) => ({
      type: row.type,
      raisedAt: row.raisedAt.toISOString(),
    });
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockStaffable(tx, tenderId);
        const dto = await validateBody(RaiseCommitteeDto, body);
        const existing = await tx.tenderCommittee.findUnique({
          where: { tenderId_type: { tenderId, type: dto.type } },
        });
        if (existing) return { created: false, body: view(existing) };
        const created = await tx.tenderCommittee.create({ data: { tenderId, type: dto.type } });
        await this.audit.record(
          {
            actorUserId: officerId,
            action: 'committee.raised',
            resourceType: 'tender',
            resourceId: tenderId,
            context: { committeeType: dto.type },
            requestId,
          },
          tx,
        );
        return { created: true, body: view(created) };
      });
    } catch (error) {
      // A simultaneous request raised it first; answer as a repeat.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const type = (body as { type?: CommitteeType }).type!;
        const row = await this.prisma.tenderCommittee.findUniqueOrThrow({
          where: { tenderId_type: { tenderId, type } },
        });
        return { created: false, body: view(row) };
      }
      throw error;
    }
  }

  // Locks the tender row for sharing and checks, under the lock, that its
  // committees can still be staffed. Lock order everywhere: tender first, then
  // the assignment, supplier or bid part (ERD, Lifecycle jobs). The deadline
  // job and evaluations lock the tender exclusively, so a status change and a
  // staffing change never interleave.
  private async lockStaffable(tx: Prisma.TransactionClient, tenderId: string) {
    await tx.$queryRaw`SELECT id FROM tenders WHERE id = ${tenderId}::uuid FOR SHARE`;
    const tender = await tx.tender.findUniqueOrThrow({
      where: { id: tenderId },
      select: { status: true },
    });
    if (!STAFFING.includes(tender.status)) throw statusChanged(tender.status);
  }

  // C3.
  async nominate(tenderId: string, type: CommitteeType, body: unknown): Promise<NominationCreated> {
    await this.access.managedTender(tenderId);
    const committee = await this.prisma.tenderCommittee.findUnique({
      where: { tenderId_type: { tenderId, type } },
      select: { id: true },
    });
    if (!committee) throw notFound();
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockStaffable(tx, tenderId);
      const dto = await validateBody(NominateDto, body);
      return tx.committeeAssignment.create({
        data: {
          committeeId: committee.id,
          tenderId,
          nomineeName: dto.nomineeName,
          nomineeEmail: dto.nomineeEmail,
        },
        select: { id: true, status: true, nomineeEmail: true },
      });
    });
    const account = await this.prisma.userAccount.findUnique({
      where: { email: row.nomineeEmail },
      select: { id: true },
    });
    return { id: row.id, status: row.status, hasAccount: !!account };
  }

  // C4: only while the nomination waits for the admin.
  async withdraw(nominationId: string): Promise<void> {
    const removed = await this.prisma.committeeAssignment.deleteMany({
      where: { id: nominationId, status: 'nominated' },
    });
    if (removed.count === 1) return;
    const exists = await this.prisma.committeeAssignment.findUnique({
      where: { id: nominationId },
      select: { id: true },
    });
    if (!exists) throw notFound();
    throw decided();
  }

  // C5: oldest first.
  async queue(query: PageQueryDto, language: Language): Promise<AdminNominationPage> {
    const where = { status: 'nominated' } satisfies Prisma.CommitteeAssignmentWhereInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.committeeAssignment.findMany({
        where,
        ...pageArgs(query),
        orderBy: [{ nominatedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          tenderId: true,
          nomineeName: true,
          nomineeEmail: true,
          committee: { select: { type: true, tender: { select: titleSelect } } },
        },
      }),
      this.prisma.committeeAssignment.count({ where }),
    ]);
    const accounts = await this.prisma.userAccount.findMany({
      where: { email: { in: rows.map((r) => r.nomineeEmail) } },
      select: { email: true },
    });
    const known = new Set(accounts.map((a) => a.email));
    return {
      data: rows.map((row) => ({
        id: row.id,
        tenderId: row.tenderId,
        tenderContent: title(row.committee.tender.translations, language),
        committeeType: row.committee.type,
        nomineeName: row.nomineeName,
        nomineeEmail: row.nomineeEmail,
        hasAccount: known.has(row.nomineeEmail),
      })),
      meta: pageMeta(query, total),
    };
  }

  // C6 approve. Order (API_CONTRACT.md, C6, an exception to §1.4): not found,
  // already decided, one committee per tender, the requesting employee, staff
  // accounts, then the tender status. A new account, its first setup link and
  // email are created with the approval (ERD, Committees).
  async approve(
    nominationId: string,
    adminId: string,
    body: unknown,
    requestId?: string,
  ): Promise<NominationDecision> {
    // The tender never changes for a nomination, so it can be read unlocked
    // to take the locks in the shared order: tender first, then assignment.
    const target = await this.prisma.committeeAssignment.findUnique({
      where: { id: nominationId },
      select: { tenderId: true },
    });
    if (!target) throw notFound();
    try {
      return await this.approveOnce(nominationId, target.tenderId, adminId, body, requestId);
    } catch (error) {
      // Another approval created this email's account at the same moment.
      // Retry once: the account now exists and gets the normal checks.
      if (error instanceof AccountRace) {
        return this.approveOnce(nominationId, target.tenderId, adminId, body, requestId);
      }
      throw error;
    }
  }

  private async approveOnce(
    nominationId: string,
    tenderId: string,
    adminId: string,
    body: unknown,
    requestId?: string,
  ): Promise<NominationDecision> {
    let queued: { id: string; revision: number } | null = null;
    let created: Language | null = null;
    // Which unique write was running, so a P2002 maps to its real cause.
    let step: 'account' | 'assignment' | null = null;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM tenders WHERE id = ${tenderId}::uuid FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM committee_assignments WHERE id = ${nominationId}::uuid FOR UPDATE`;
        const row = await tx.committeeAssignment.findUnique({
          where: { id: nominationId },
          select: {
            status: true,
            nomineeName: true,
            nomineeEmail: true,
            committee: {
              select: { tender: { select: { status: true, requestedByUserId: true } } },
            },
          },
        });
        if (!row) throw notFound();
        if (row.status !== 'nominated') throw decided();
        const tender = row.committee.tender;

        let user = await tx.userAccount.findUnique({
          where: { email: row.nomineeEmail },
          select: { id: true, roles: { select: { role: true } } },
        });
        if (user) {
          const elsewhere = await tx.committeeAssignment.findFirst({
            where: { tenderId, userId: user.id, status: 'approved' },
            select: { id: true },
          });
          if (elsewhere) throw oneCommittee();
          if (tender.requestedByUserId === user.id) {
            throw conflict(
              'ASSIGNMENT_REQUESTING_EMPLOYEE_CONFLICT',
              'The requesting employee cannot serve on this tender',
            );
          }
          if (user.roles.some((r) => r.role === 'procurement_officer' || r.role === 'admin')) {
            throw conflict('ASSIGNMENT_STAFF_CONFLICT', 'Officers and admins cannot serve');
          }
        }
        if (!STAFFING.includes(tender.status)) throw statusChanged(tender.status);

        if (!user) {
          // The body matters only here; an existing account ignores it.
          const dto = await validateBody(ApproveNominationDto, body);
          if (!dto.preferredLanguage) {
            throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Language needed', [
              { field: 'preferredLanguage', code: 'REQUIRED' },
            ]);
          }
          const language = dto.preferredLanguage;
          step = 'account';
          user = await tx.userAccount.create({
            data: {
              email: row.nomineeEmail,
              displayName: row.nomineeName,
              preferredLanguage: language,
              status: 'pending_setup',
            },
            select: { id: true, roles: { select: { role: true } } },
          });
          step = null;
          await this.tokens.issue(tx, user.id);
          queued = await tx.emailMessage.create({
            data: {
              kind: 'account_setup',
              recipientUserId: user.id,
              recipientEmail: row.nomineeEmail,
              language,
              ...committeeSetupEmail(language, row.nomineeName),
              status: 'sending',
            },
            select: { id: true, revision: true },
          });
          created = language;
        }
        step = 'assignment';
        await tx.committeeAssignment.update({
          where: { id: nominationId },
          data: {
            status: 'approved',
            userId: user.id,
            approvedByUserId: adminId,
            decidedAt: new Date(),
          },
        });
        step = null;
        await this.audit.record(
          {
            actorUserId: adminId,
            action: 'committee_member.approved',
            resourceType: 'committee_assignment',
            resourceId: nominationId,
            context: { memberUserId: user.id, accountCreated: created !== null },
            requestId,
          },
          tx,
        );
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        if (step === 'account') throw new AccountRace();
        // The same person was approved on this tender at the same moment.
        if (step === 'assignment') throw oneCommittee();
      }
      throw error;
    }
    if (queued) {
      const { id, revision } = queued as { id: string; revision: number };
      await this.emails.enqueue(id, revision);
    }
    const language = created as Language | null;
    return language
      ? { status: 'approved', accountCreated: true, setupEmail: { language, status: 'sending' } }
      : { status: 'approved', accountCreated: false };
  }

  // C6 reject.
  async reject(nominationId: string, adminId: string): Promise<NominationDecision> {
    const changed = await this.prisma.committeeAssignment.updateMany({
      where: { id: nominationId, status: 'nominated' },
      data: { status: 'rejected', approvedByUserId: adminId, decidedAt: new Date() },
    });
    if (changed.count === 1) return { status: 'rejected' };
    const exists = await this.prisma.committeeAssignment.findUnique({
      where: { id: nominationId },
      select: { id: true },
    });
    if (!exists) throw notFound();
    throw decided();
  }

  // C7: approved assignments only. `open` while this committee has bids left
  // to evaluate on a tender under evaluation.
  async mine(userId: string, query: PageQueryDto, language: Language): Promise<AssignmentPage> {
    const where = { userId, status: 'approved' } satisfies Prisma.CommitteeAssignmentWhereInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.committeeAssignment.findMany({
        where,
        ...pageArgs(query),
        orderBy: [{ decidedAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          tenderId: true,
          committee: {
            select: { type: true, tender: { select: { status: true, ...titleSelect } } },
          },
        },
      }),
      this.prisma.committeeAssignment.count({ where }),
    ]);
    // Counts include only bids this assignment may see (API_CONTRACT.md, C7).
    const pending = await Promise.all(
      rows.map((row) =>
        row.committee.tender.status === 'under_evaluation'
          ? this.evaluations.pendingFor(row.tenderId, row.committee.type)
          : Promise.resolve(0),
      ),
    );
    return {
      data: rows.map((row, i) => {
        const { status } = row.committee.tender;
        return {
          assignmentId: row.id,
          tenderId: row.tenderId,
          tenderContent: title(row.committee.tender.translations, language),
          committeeType: row.committee.type,
          stage:
            status === 'awarded' || status === 'cancelled'
              ? 'read_only'
              : pending[i] > 0
                ? 'open'
                : 'waiting',
          pendingCount: pending[i],
        };
      }),
      meta: pageMeta(query, total),
    };
  }
}
