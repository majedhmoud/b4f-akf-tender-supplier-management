import { HttpStatus, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { ApiException } from '../common/errors/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ACCESS_COOKIE, AuthSettings } from './auth.settings.js';
import {
  hasSupplierAccess,
  USE_MOBILE_BEARER,
  type SessionRequest,
} from './mobile-auth.metadata.js';

const extractBearer = ExtractJwt.fromAuthHeaderAsBearerToken();

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  channel?: 'mobile';
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
      jwtFromRequest: (req: SessionRequest) =>
        req[USE_MOBILE_BEARER]
          ? extractBearer(req)
          : ((req.cookies?.[ACCESS_COOKIE] as string | undefined) ?? null),
      secretOrKey: settings.jwtSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: SessionRequest, payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const channel = req[USE_MOBILE_BEARER] ? 'mobile' : 'web';
    if ((payload.channel ?? 'web') !== channel) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Sign-in required');
    }
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      select: {
        revokedAt: true,
        expiresAt: true,
        channel: true,
        user: {
          select: {
            id: true,
            status: true,
            roles: { select: { role: true } },
            supplier: { select: { id: true } },
          },
        },
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.channel !== channel ||
      session.user.id !== payload.sub
    ) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'SESSION_REVOKED', 'Session revoked');
    }
    if (session.expiresAt <= new Date()) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Session ended');
    }
    // Account status is checked on every request (ENGINEERING_STANDARDS.md §2.1).
    if (session.user.status === 'disabled') {
      throw new ApiException(HttpStatus.FORBIDDEN, 'ACCOUNT_DISABLED', 'Account disabled');
    }
    if (
      session.user.status !== 'active' ||
      (channel === 'mobile' && !hasSupplierAccess(session.user))
    ) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Account not active');
    }

    if (channel === 'mobile') {
      return {
        id: session.user.id,
        sessionId: payload.sid,
        roles: ['supplier'],
        sessionChannel: channel,
      };
    }
    return {
      id: session.user.id,
      sessionId: payload.sid,
      roles: session.user.roles.map((r) => r.role),
    };
  }
}
