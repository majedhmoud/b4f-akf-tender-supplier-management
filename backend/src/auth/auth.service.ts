import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { ApiException } from '../common/errors/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  AuthSettings,
  CSRF_COOKIE,
  REFRESH_COOKIE,
} from './auth.settings.js';
import type { AccessTokenPayload } from './jwt.strategy.js';
import { SessionView } from './dto/session-view.dto.js';

// Compared against when the email is unknown, so a wrong email takes as long
// as a wrong password and does not reveal which accounts exist.
const UNKNOWN_USER_HASH = bcrypt.hashSync(randomBytes(16).toString('hex'), 12);

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function invalidCredentials(): ApiException {
  return new ApiException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials');
}

function sessionRevoked(): ApiException {
  return new ApiException(HttpStatus.UNAUTHORIZED, 'SESSION_REVOKED', 'Session revoked');
}

// Sign-in, refresh, and sign-out, as in API_CONTRACT.md §1.1 and the Auth
// payloads. Refresh tokens are stored hashed and rotate on every use; reusing
// a replaced token revokes the session (ERD, Supporting tables).
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly settings: AuthSettings,
  ) {}

  async signIn(email: string, password: string, res: Response): Promise<SessionView> {
    const user = await this.prisma.userAccount.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, status: true, passwordHash: true },
    });

    if (!user) {
      await bcrypt.compare(password, UNKNOWN_USER_HASH);
      throw invalidCredentials();
    }
    if (user.status === 'pending_setup') {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'ACCOUNT_PENDING_SETUP',
        'Account setup not finished',
      );
    }
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw invalidCredentials();
    }
    if (user.status === 'disabled') {
      throw new ApiException(HttpStatus.FORBIDDEN, 'ACCOUNT_DISABLED', 'Account disabled');
    }

    return this.startSession(user.id, res);
  }

  // Opens a session for an active account and sets its cookies. Used by
  // sign-in and by account setup (API_CONTRACT.md, Sign-up and account setup).
  async startSession(userId: string, res: Response): Promise<SessionView> {
    const refreshToken = randomBytes(32).toString('base64url');
    const session = await this.prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + this.settings.sessionTtlMs),
        refreshTokens: { create: { tokenHash: hashToken(refreshToken) } },
      },
      select: { id: true },
    });

    this.setSessionCookies(res, { sub: userId, sid: session.id }, refreshToken);
    return this.sessionView(userId);
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const presented = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!presented) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'No refresh token');
    }

    const stored = await this.prisma.sessionRefreshToken.findUnique({
      where: { tokenHash: hashToken(presented) },
      select: {
        replacedAt: true,
        session: {
          select: {
            id: true,
            revokedAt: true,
            expiresAt: true,
            user: { select: { id: true, status: true } },
          },
        },
      },
    });
    if (!stored) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Unknown refresh token');
    }

    const { session } = stored;
    if (stored.replacedAt) {
      // An old token came back: someone may hold a stolen copy. End the session.
      await this.revokeSession(session.id);
      throw sessionRevoked();
    }
    if (session.revokedAt || session.user.status !== 'active') throw sessionRevoked();
    if (session.expiresAt <= new Date()) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Session ended');
    }

    const nextToken = randomBytes(32).toString('base64url');
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Only one request can replace the current token; a parallel second
      // refresh finds it already replaced and counts as reuse.
      const claimed = await tx.sessionRefreshToken.updateMany({
        where: { tokenHash: hashToken(presented), replacedAt: null },
        data: { replacedAt: new Date() },
      });
      if (claimed.count !== 1) return false;
      await tx.sessionRefreshToken.create({
        data: { tokenHash: hashToken(nextToken), sessionId: session.id },
      });
      return true;
    });
    if (!rotated) {
      await this.revokeSession(session.id);
      throw sessionRevoked();
    }

    this.setSessionCookies(res, { sub: session.user.id, sid: session.id }, nextToken);
  }

  // Ends the session the cookies belong to, if any, and always clears them.
  async signOut(req: Request, res: Response): Promise<void> {
    const sessionId = await this.sessionIdFromCookies(req);
    if (sessionId) await this.revokeSession(sessionId);

    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) {
      res.clearCookie(name, this.settings.clearOptions(name));
    }
  }

  async sessionView(userId: string): Promise<SessionView> {
    const user = await this.prisma.userAccount.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        preferredLanguage: true,
        roles: { select: { role: true } },
      },
    });
    return {
      user: { ...user, roles: user.roles.map((r) => r.role) },
      supplier: null,
      serverTime: new Date().toISOString(),
    };
  }

  private async sessionIdFromCookies(req: Request): Promise<string | null> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (refreshToken) {
      const stored = await this.prisma.sessionRefreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
        select: { sessionId: true },
      });
      if (stored) return stored.sessionId;
    }

    const accessToken = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    if (accessToken) {
      try {
        return this.jwt.verify<AccessTokenPayload>(accessToken, { ignoreExpiration: true }).sid;
      } catch {
        return null;
      }
    }
    return null;
  }

  private async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private setSessionCookies(res: Response, payload: AccessTokenPayload, refreshToken: string) {
    const accessToken = this.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
    res.cookie(ACCESS_COOKIE, accessToken, this.settings.accessCookie());
    res.cookie(REFRESH_COOKIE, refreshToken, this.settings.refreshCookie());
  }
}
