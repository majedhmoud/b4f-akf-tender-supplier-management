import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { doubleCsrf, type DoubleCsrfUtilities } from 'csrf-csrf';
import type { Request, Response } from 'express';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { ApiException } from '../common/errors/api-exception.js';
import {
  ACCESS_COOKIE,
  AuthSettings,
  CSRF_COOKIE,
  CSRF_HEADER,
  VISITOR_COOKIE,
} from './auth.settings.js';

interface AccessPayload {
  sid?: string;
}

// CSRF tokens bound to the current session, or to the anonymous visitor
// before sign-in. See API_CONTRACT.md §1.1 and ADR 0004.
@Injectable()
export class CsrfService {
  private readonly csrf: DoubleCsrfUtilities;

  constructor(
    private readonly settings: AuthSettings,
    private readonly jwt: JwtService,
  ) {
    this.csrf = doubleCsrf({
      getSecret: () => settings.csrfSecret,
      getSessionIdentifier: (req) => this.sessionIdentifier(req),
      cookieName: CSRF_COOKIE,
      cookieOptions: settings.csrfCookie(),
      getCsrfTokenFromRequest: (req) => req.headers[CSRF_HEADER],
    });
  }

  // The session ID inside the access cookie, even if the token has expired,
  // so a refresh request can still prove its CSRF token. Otherwise the
  // anonymous visitor ID.
  private sessionIdentifier(req: Request): string {
    const accessToken = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    if (accessToken) {
      try {
        const payload = this.jwt.verify<AccessPayload>(accessToken, { ignoreExpiration: true });
        if (payload.sid) return `session:${payload.sid}`;
      } catch {
        // A tampered cookie falls back to the visitor ID, so its token fails.
      }
    }
    return `visitor:${this.visitorScope(req) ?? ''}`;
  }

  // Issues a token, first giving an anonymous visitor its ID cookie.
  issue(req: Request, res: Response): string {
    if (!this.visitorScope(req)) {
      const id = randomUUID();
      const value = `${id}.${this.signVisitor(id)}`;
      res.cookie(VISITOR_COOKIE, value, this.settings.visitorCookie());
      req.cookies = { ...req.cookies, [VISITOR_COOKIE]: value };
    }
    return this.csrf.generateCsrfToken(req, res, { overwrite: true });
  }

  private signVisitor(id: string): string {
    return createHmac('sha256', this.settings.csrfSecret)
      .update(`visitor:${id}`)
      .digest('base64url');
  }

  private visitorScope(req: Request): string | null {
    const value: unknown = req.cookies?.[VISITOR_COOKIE];
    if (typeof value !== 'string') return null;
    const parts = value.split('.');
    const [id, signature] = parts;
    if (parts.length !== 2 || !/^[0-9a-f-]{36}$/i.test(id ?? '') || !signature) return null;
    const expected = Buffer.from(this.signVisitor(id));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual) ? id : null;
  }

  // A signed, server-issued scope survives CSRF renewal without allowing a
  // caller to select another browser's idempotency scope (API §1.3).
  guestScope(req: Request): string {
    const scope = this.visitorScope(req);
    if (!scope)
      throw new ApiException(HttpStatus.FORBIDDEN, 'CSRF_TOKEN_INVALID', 'Bootstrap CSRF first');
    return scope;
  }

  assertValid(req: Request): void {
    if (!this.csrf.validateRequest(req)) {
      throw new ApiException(HttpStatus.FORBIDDEN, 'CSRF_TOKEN_INVALID', 'Invalid CSRF token');
    }
  }
}
