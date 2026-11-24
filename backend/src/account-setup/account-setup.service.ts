import { HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';
import { ApiException } from '../common/errors/api-exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import { EmailQueue } from '../notifications/email-queue.js';
import { accountSetupEmail, committeeSetupEmail } from '../notifications/email-templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccountType, CompletedSetupView, SetupLinkView } from './dto/account-setup.dto.js';
import { hashToken, SetupTokens } from './setup-tokens.js';

const MIN_PASSWORD_LENGTH = 12;
// At most 5 setup links an hour per account, the first one included
// (ENGINEERING_STANDARDS.md §2.4).
const LINKS_PER_HOUR = 5;
const HOUR_MS = 3_600_000;

const tokenSelect = {
  id: true,
  userId: true,
  expiresAt: true,
  usedAt: true,
  user: {
    select: {
      email: true,
      displayName: true,
      preferredLanguage: true,
      status: true,
      supplier: { select: { id: true } },
    },
  },
} satisfies Prisma.AccountSetupTokenSelect;
type TokenRow = Prisma.AccountSetupTokenGetPayload<{ select: typeof tokenSelect }>;

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

function accountType(row: TokenRow): AccountType {
  return row.user.supplier ? 'supplier' : 'committee_member';
}

// S1–S3 in API_CONTRACT.md §2. The link holder is not signed in; the token
// is the only proof, so every answer about an unknown token is a plain 404.
@Injectable()
export class AccountSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: SetupTokens,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly emails: EmailQueue,
  ) {}

  async verify(token: string): Promise<SetupLinkView> {
    const row = await this.prisma.accountSetupToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: tokenSelect,
    });
    usable(row);
    return {
      email: maskEmail(row.user.email),
      preferredLanguage: row.user.preferredLanguage,
      accountType: accountType(row),
    };
  }

  async complete(token: string, password: string, res: Response): Promise<CompletedSetupView> {
    const passwordHash = await bcrypt.hash(password, 12);
    const row = await this.prisma.$transaction(async (tx) => {
      // The row lock makes a second, simultaneous completion wait, then see
      // the token used (docs/07_CONTRACTS/ACCOUNT_SETUP_EMAIL.md).
      await tx.$queryRaw`SELECT id FROM account_setup_tokens WHERE token_hash = ${hashToken(token)} FOR UPDATE`;
      const found = await tx.accountSetupToken.findUnique({
        where: { tokenHash: hashToken(token) },
        select: tokenSelect,
      });
      usable(found);
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Password too weak', [
          { field: 'password', code: 'PASSWORD_TOO_WEAK' },
        ]);
      }
      const now = new Date();
      await tx.userAccount.update({
        where: { id: found.userId },
        data: { passwordHash, status: 'active', emailVerifiedAt: now },
      });
      // Every other link to this account stops working too.
      await tx.accountSetupToken.updateMany({
        where: { userId: found.userId, usedAt: null },
        data: { usedAt: now },
      });
      await this.audit.record(
        {
          actorUserId: found.userId,
          action: 'account.password_set',
          resourceType: 'user_account',
          resourceId: found.userId,
        },
        tx,
      );
      return found;
    });

    const session = await this.auth.startSession(row.userId, res);
    return { ...session, next: row.user.supplier ? 'supplier_profile' : 'my_assignments' };
  }

  // Always answers 202, so the response never says whether a token exists.
  async resend(token: string): Promise<void> {
    const queued = await this.prisma.$transaction(async (tx) => {
      const row = await tx.accountSetupToken.findUnique({
        where: { tokenHash: hashToken(token) },
        select: tokenSelect,
      });
      // Only an unused, expired link to an account still waiting for setup.
      if (!row || row.usedAt || row.expiresAt > new Date()) return null;
      if (row.user.status !== 'pending_setup') return null;
      await tx.$queryRaw`SELECT id FROM user_accounts WHERE id = ${row.userId}::uuid FOR UPDATE`;
      const sentLastHour = await tx.emailMessage.count({
        where: {
          recipientUserId: row.userId,
          kind: 'account_setup',
          preparedAt: { gt: new Date(Date.now() - HOUR_MS) },
        },
      });
      if (sentLastHour >= LINKS_PER_HOUR) return null;

      await this.tokens.issue(tx, row.userId);
      // A new message, in the account's language now (ERD, Email language).
      const language = row.user.preferredLanguage;
      const email = await tx.emailMessage.create({
        data: {
          kind: 'account_setup',
          recipientUserId: row.userId,
          recipientEmail: row.user.email,
          language,
          // A committee member has no supplier, so it gets the committee wording.
          ...(row.user.supplier ? accountSetupEmail : committeeSetupEmail)(
            language,
            row.user.displayName,
          ),
          status: 'sending',
        },
        select: { id: true, revision: true },
      });
      return email;
    });
    if (queued) await this.emails.enqueue(queued.id, queued.revision);
  }
}

// 404 for an unknown token, then 410 for a used or expired one.
function usable(row: TokenRow | null): asserts row is TokenRow {
  if (!row) {
    throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Setup link not found');
  }
  if (row.usedAt || row.user.status !== 'pending_setup') {
    throw new ApiException(HttpStatus.GONE, 'SETUP_LINK_USED', 'Setup link already used');
  }
  if (row.expiresAt <= new Date()) {
    throw new ApiException(HttpStatus.GONE, 'SETUP_LINK_EXPIRED', 'Setup link expired');
  }
}
