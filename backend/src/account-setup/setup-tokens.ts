import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'node:crypto';
import type { Language, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

// A link is valid for 48 hours (ENGINEERING_STANDARDS.md §2.1).
export const SETUP_LINK_HOURS = 48;
const HOUR_MS = 3_600_000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Account setup tokens (ADR 0005). The raw token is derived from the token
// row's id with a server secret, so it is never stored: the database keeps
// only its hash, and the email worker derives the same link again at send
// time, also after a restart or a retry (docs/07_CONTRACTS/ACCOUNT_SETUP_EMAIL.md).
@Injectable()
export class SetupTokens {
  private readonly secret: string;
  private readonly webOrigin: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.secret = config.getOrThrow<string>('SETUP_TOKEN_SECRET');
    this.webOrigin = config.get<string>('WEB_ORIGIN', 'http://localhost:3000');
  }

  private derive(tokenId: string): string {
    return createHmac('sha256', this.secret).update(`setup:${tokenId}`).digest('base64url');
  }

  // Issues a new token for the account inside the caller's transaction.
  async issue(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const token = await tx.accountSetupToken.create({
      data: {
        userId,
        tokenHash: 'pending',
        expiresAt: new Date(Date.now() + SETUP_LINK_HOURS * HOUR_MS),
      },
      select: { id: true },
    });
    await tx.accountSetupToken.update({
      where: { id: token.id },
      data: { tokenHash: hashToken(this.derive(token.id)) },
    });
  }

  // The link to the account's newest unused, unexpired token, or null.
  async currentLink(userId: string, language: Language): Promise<string | null> {
    const token = await this.prisma.accountSetupToken.findFirst({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'desc' },
      select: { id: true },
    });
    if (!token) return null;
    // The token sits in the fragment, so it never reaches a server log (API_CONTRACT.md).
    return `${this.webOrigin}/${language}/account-setup#token=${this.derive(token.id)}`;
  }
}
