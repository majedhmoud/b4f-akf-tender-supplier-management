import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { ApiException } from '../common/errors/api-exception.js';
import type { Language, SessionChannel } from '../generated/prisma/client.js';
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
import type { MobileSessionView } from './dto/mobile-session.dto.js';
import { hasSupplierAccess } from './mobile-auth.metadata.js';

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
    const user = await this.authenticate(email, password, 'web');
    return this.startSession(user.id, res);
  }

  async signInMobile(email: string, password: string): Promise<MobileSessionView> {
    const user = await this.authenticate(email, password, 'mobile');
    const { sessionId, refreshToken } = await this.createSession(user.id, 'mobile');
    return this.mobileSessionView(user, sessionId, refreshToken);
  }

  private async authenticate(email: string, password: string, channel: SessionChannel) {
    const user = await this.prisma.userAccount.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        status: true,
        passwordHash: true,
        preferredLanguage: true,
        roles: { select: { role: true } },
        supplier: { select: { id: true } },
      },
    });

    if (!user || (channel === 'mobile' && !hasSupplierAccess(user))) {
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

    return user;
  }

  // Opens a session for an active account and sets its cookies. Used by
  // sign-in and by account setup (API_CONTRACT.md, Sign-up and account setup).
  async startSession(userId: string, res: Response): Promise<SessionView> {
    const { sessionId, refreshToken } = await this.createSession(userId, 'web');
    this.setSessionCookies(res, { sub: userId, sid: sessionId }, refreshToken);
    return this.sessionView(userId);
  }

  private async createSession(userId: string, channel: SessionChannel) {
    const refreshToken = randomBytes(32).toString('base64url');
    const session = await this.prisma.session.create({
      data: {
        userId,
        channel,
        expiresAt: new Date(Date.now() + this.settings.sessionTtlMs),
        refreshTokens: { create: { tokenHash: hashToken(refreshToken) } },
      },
      select: { id: true },
    });

    return { sessionId: session.id, refreshToken };
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const presented = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!presented) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'No refresh token');
    }
    const { session, refreshToken } = await this.rotateRefreshToken(presented, 'web');
    this.setSessionCookies(res, { sub: session.user.id, sid: session.id }, refreshToken);
  }

  async refreshMobile(presented: string): Promise<MobileSessionView> {
    const { session, refreshToken } = await this.rotateRefreshToken(presented, 'mobile');
    return this.mobileSessionView(session.user, session.id, refreshToken);
  }

  private async rotateRefreshToken(presented: string, channel: SessionChannel) {
    const tokenHash = hashToken(presented);
    const stored = await this.prisma.sessionRefreshToken.findUnique({
      where: { tokenHash },
      select: {
        replacedAt: true,
        session: {
          select: {
            id: true,
            channel: true,
            revokedAt: true,
            expiresAt: true,
            user: {
              select: {
                id: true,
                status: true,
                preferredLanguage: true,
                roles: { select: { role: true } },
                supplier: { select: { id: true } },
              },
            },
          },
        },
      },
    });
    if (!stored || stored.session.channel !== channel) {
      if (channel === 'mobile') throw sessionRevoked();
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Unknown refresh token');
    }

    const { session } = stored;
    if (stored.replacedAt) {
      // An old token came back: someone may hold a stolen copy. End the session.
      await this.revokeSession(session.id, channel);
      throw sessionRevoked();
    }
    if (
      session.revokedAt ||
      session.user.status !== 'active' ||
      (channel === 'mobile' && !hasSupplierAccess(session.user))
    ) {
      throw sessionRevoked();
    }
    if (session.expiresAt <= new Date()) {
      if (channel === 'mobile') throw sessionRevoked();
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Session ended');
    }

    const nextToken = randomBytes(32).toString('base64url');
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Only one request can replace the current token; a parallel second
      // refresh finds it already replaced and counts as reuse.
      const claimed = await tx.sessionRefreshToken.updateMany({
        where: { tokenHash, replacedAt: null },
        data: { replacedAt: new Date() },
      });
      if (claimed.count !== 1) return false;
      await tx.sessionRefreshToken.create({
        data: { tokenHash: hashToken(nextToken), sessionId: session.id },
      });
      return true;
    });
    if (!rotated) {
      await this.revokeSession(session.id, channel);
      throw sessionRevoked();
    }

    return { session, refreshToken: nextToken };
  }

  // Ends the session the cookies belong to, if any, and always clears them.
  async signOut(req: Request, res: Response): Promise<void> {
    const sessionId = await this.sessionIdFromCookies(req);
    if (sessionId) await this.revokeSession(sessionId, 'web');

    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) {
      res.clearCookie(name, this.settings.clearOptions(name));
    }
  }

  async signOutMobile(refreshToken: string): Promise<void> {
    const stored = await this.prisma.sessionRefreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { sessionId: true },
    });
    if (stored) await this.revokeSession(stored.sessionId, 'mobile');
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
        select: { sessionId: true, session: { select: { channel: true } } },
      });
      if (stored?.session.channel === 'web') return stored.sessionId;
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

  private async revokeSession(sessionId: string, channel: SessionChannel): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null, channel },
      data: { revokedAt: new Date() },
    });
  }

  private mobileSessionView(
    user: { id: string; preferredLanguage: Language },
    sessionId: string,
    refreshToken: string,
  ): MobileSessionView {
    const payload: AccessTokenPayload = { sub: user.id, sid: sessionId, channel: 'mobile' };
    return {
      accessToken: this.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_TTL_SECONDS }),
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: { id: user.id, preferredLanguage: user.preferredLanguage },
    };
  }

  private setSessionCookies(res: Response, payload: AccessTokenPayload, refreshToken: string) {
    const accessToken = this.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
    res.cookie(ACCESS_COOKIE, accessToken, this.settings.accessCookie());
    res.cookie(REFRESH_COOKIE, refreshToken, this.settings.refreshCookie());
  }
}
