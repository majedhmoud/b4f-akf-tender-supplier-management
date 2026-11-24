import { HttpStatus, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { ApiException } from '../common/errors/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ACCESS_COOKIE, AuthSettings } from './auth.settings.js';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
}

// Reads the access token from its HttpOnly cookie and checks the session on
// every request, so sign-out stops every token of that session at once
// (API_CONTRACT.md §1.1, "Sign-out").
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    settings: AuthSettings,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req.cookies?.[ACCESS_COOKIE] as string | undefined) ?? null,
      ]),
      secretOrKey: settings.jwtSecret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      select: {
        revokedAt: true,
        expiresAt: true,
        user: { select: { id: true, status: true, roles: { select: { role: true } } } },
      },
    });

    if (!session || session.revokedAt || session.user.id !== payload.sub) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'SESSION_REVOKED', 'Session revoked');
    }
    if (session.expiresAt <= new Date()) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Session ended');
    }
    // Account status is checked on every request (ENGINEERING_STANDARDS.md §2.1).
    if (session.user.status === 'disabled') {
      throw new ApiException(HttpStatus.FORBIDDEN, 'ACCOUNT_DISABLED', 'Account disabled');
    }
    if (session.user.status !== 'active') {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Account not active');
    }

    return {
      id: session.user.id,
      sessionId: payload.sid,
      roles: session.user.roles.map((r) => r.role),
    };
  }
}
