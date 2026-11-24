import { HttpStatus, Injectable } from '@nestjs/common';
import { AccessService, notFound } from '../auth/access.service.js';
import { ApiException } from '../common/errors/api-exception.js';
import { validateBody } from '../common/errors/validate-body.js';
import { pageArgs, pageMeta } from '../common/pagination/pagination.js';
import type { EmailKind, Prisma } from '../generated/prisma/client.js';
import { EmailQueue } from '../notifications/email-queue.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  EditEmailDto,
  SendAllDto,
  SendEmailDto,
  type EmailListQueryDto,
  type OfficerEmail,
  type OfficerEmailPage,
  type RevisionResult,
  type SendAllResult,
  type SendResult,
  type SkippedEmail,
} from './dto/officer-email.dto.js';

// The kinds the procurement_officer reviews and sends. Account setup emails
// are automatic and never appear here.
const KINDS: Record<'award' | 'cancellation', EmailKind[]> = {
  award: ['award_winner', 'award_other'],
  cancellation: ['cancellation'],
};
const OFFICER_KINDS: EmailKind[] = ['award_winner', 'award_other', 'cancellation'];

const emailSelect = {
  id: true,
  kind: true,
  status: true,
  revision: true,
  language: true,
  subject: true,
  body: true,
  failureCode: true,
  failedAt: true,
  sentAt: true,
  recipient: {
    select: { email: true, supplier: { select: { id: true, legalName: true } } },
  },
} satisfies Prisma.EmailMessageSelect;
type EmailRow = Prisma.EmailMessageGetPayload<{ select: typeof emailSelect }>;

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

function view(row: EmailRow): OfficerEmail {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    revision: row.revision,
    language: row.language,
    dir: row.language === 'ar' ? 'rtl' : 'ltr',
    recipient: {
      supplierId: row.recipient.supplier?.id ?? '',
      legalName: row.recipient.supplier?.legalName ?? '',
      email: maskEmail(row.recipient.email),
    },
    subject: row.subject,
    body: row.body,
    failure:
      row.status === 'failed' && row.failureCode
        ? { code: row.failureCode, at: row.failedAt?.toISOString() ?? '' }
        : null,
    sentAt: row.sentAt?.toISOString() ?? null,
  };
}

function versionConflict(currentRevision: number): ApiException {
  return new ApiException(HttpStatus.CONFLICT, 'VERSION_CONFLICT', 'Email was changed', undefined, {
    currentRevision,
  });
}

// E1–E5 (API_CONTRACT.md, Emails). Sending names the revision the officer
// reviewed and claims it only from draft or failed, so a delivery is
// scheduled once even for simultaneous requests (ERD, Emails).
@Injectable()
export class OfficerEmailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly queue: EmailQueue,
  ) {}

  // E1.
  async list(tenderId: string, query: EmailListQueryDto): Promise<OfficerEmailPage> {
    await this.access.managedTender(tenderId);
    const where = { tenderId, kind: { in: KINDS[query.kind] } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.emailMessage.findMany({
        where,
        ...pageArgs(query),
        orderBy: [{ kind: 'desc' }, { preparedAt: 'asc' }, { id: 'asc' }],
        select: emailSelect,
      }),
      this.prisma.emailMessage.count({ where }),
    ]);
    return { data: rows.map(view), meta: pageMeta(query, total) };
  }

  private async find(emailId: string): Promise<EmailRow & { tenderId: string | null }> {
    const row = await this.prisma.emailMessage.findFirst({
      where: { id: emailId, kind: { in: OFFICER_KINDS } },
      select: { ...emailSelect, tenderId: true },
    });
    if (!row) throw notFound();
    return row;
  }

  // E2.
  async detail(emailId: string): Promise<OfficerEmail> {
    return view(await this.find(emailId));
  }

  // E3: while draft or failed, at the reviewed revision.
  async edit(emailId: string, body: unknown): Promise<RevisionResult> {
    const current = await this.find(emailId);
    if (current.status === 'sending' || current.status === 'sent') {
      throw new ApiException(HttpStatus.CONFLICT, 'EMAIL_NOT_EDITABLE', 'Email not editable');
    }
    const dto = await validateBody(EditEmailDto, body);
    const changed = await this.prisma.emailMessage.updateMany({
      where: { id: emailId, revision: dto.revision, status: { in: ['draft', 'failed'] } },
      data: { subject: dto.subject, body: dto.body, revision: { increment: 1 } },
    });
    if (changed.count !== 1) {
      const fresh = await this.find(emailId);
      if (fresh.status === 'sending' || fresh.status === 'sent') {
        throw new ApiException(HttpStatus.CONFLICT, 'EMAIL_NOT_EDITABLE', 'Email not editable');
      }
      throw versionConflict(fresh.revision);
    }
    return { revision: dto.revision + 1 };
  }

  // Claims one reviewed revision; true when this call scheduled the delivery.
  private async claim(emailId: string, revision: number, officerId: string): Promise<boolean> {
    const before = await this.prisma.emailMessage.findUnique({
      where: { id: emailId },
      select: { status: true },
    });
    const claimed = await this.prisma.emailMessage.updateMany({
      where: { id: emailId, revision, status: { in: ['draft', 'failed'] } },
      data: { status: 'sending', failureCode: null, failedAt: null, sentByUserId: officerId },
    });
    if (claimed.count !== 1) return false;
    // A retry of a failed revision reuses its delivery ID, so drop the old job.
    if (before?.status === 'failed') await this.queue.forget(emailId, revision);
    await this.queue.enqueue(emailId, revision);
    return true;
  }

  // E4: 202 when this call starts the delivery; 200 with the current status
  // when it is already sending or sent. Nothing is delivered twice.
  async send(
    emailId: string,
    body: unknown,
    officerId: string,
  ): Promise<{ started: boolean; body: SendResult }> {
    const current = await this.find(emailId);
    const dto = await validateBody(SendEmailDto, body);
    if (current.status === 'sending' || current.status === 'sent') {
      return { started: false, body: { status: current.status, revision: current.revision } };
    }
    if (current.revision !== dto.revision) throw versionConflict(current.revision);
    if (await this.claim(emailId, dto.revision, officerId)) {
      return { started: true, body: { status: 'sending', revision: dto.revision } };
    }
    const fresh = await this.find(emailId);
    if (fresh.status === 'sending' || fresh.status === 'sent') {
      return { started: false, body: { status: fresh.status, revision: fresh.revision } };
    }
    throw versionConflict(fresh.revision);
  }

  // E5: sends every listed email at its reviewed revision.
  async sendAll(tenderId: string, body: unknown, officerId: string): Promise<SendAllResult> {
    await this.access.managedTender(tenderId);
    const dto = await validateBody(SendAllDto, body);
    const rows = await this.prisma.emailMessage.findMany({
      where: { tenderId, kind: { in: KINDS[dto.kind] } },
      select: { id: true, status: true, revision: true },
      orderBy: { preparedAt: 'asc' },
    });
    const sending: string[] = [];
    const skipped: SkippedEmail[] = [];
    for (const row of rows) {
      const reviewed = dto.revisions[row.id];
      if (row.status === 'sent') skipped.push({ id: row.id, reason: 'already_sent' });
      else if (row.status === 'sending') skipped.push({ id: row.id, reason: 'already_sending' });
      else if (typeof reviewed !== 'number') skipped.push({ id: row.id, reason: 'not_listed' });
      else if (reviewed !== row.revision) skipped.push({ id: row.id, reason: 'revision_changed' });
      else if (await this.claim(row.id, reviewed, officerId)) sending.push(row.id);
      else skipped.push({ id: row.id, reason: 'already_sending' });
    }
    return { sending, skipped };
  }
}
