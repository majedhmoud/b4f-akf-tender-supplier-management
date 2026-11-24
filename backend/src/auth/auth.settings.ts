import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

// Cookie names and lifetimes from API_CONTRACT.md §1.1.
export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const VISITOR_COOKIE = 'visitor_id';
export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

export const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
const VISITOR_TTL_MS = 365 * 24 * 60 * 60 * 1000;

// The refresh cookie is only sent to the auth endpoints that use it.
const REFRESH_COOKIE_PATH = '/api/v1/auth';

// Reads the auth settings from the environment once, with safe defaults.
@Injectable()
export class AuthSettings {
  readonly jwtSecret: string;
  readonly csrfSecret: string;
  readonly cookieSecure: boolean;
  readonly sessionTtlMs: number;
  readonly signInRateLimit: number;

  constructor(config: ConfigService) {
    this.jwtSecret = config.getOrThrow<string>('JWT_SECRET');
    this.csrfSecret = config.getOrThrow<string>('CSRF_SECRET');
    // Browsers accept Secure cookies on http://localhost. Only the API tests,
    // whose HTTP client does not, turn this off.
    this.cookieSecure = config.get<string>('COOKIE_SECURE', 'true') !== 'false';
    this.sessionTtlMs = Number(config.get('SESSION_TTL_HOURS', 168)) * 60 * 60 * 1000;
    this.signInRateLimit = Number(config.get('SIGN_IN_RATE_LIMIT', 5));
  }

  private base(): CookieOptions {
    return { httpOnly: true, secure: this.cookieSecure, sameSite: 'lax' };
  }

  accessCookie(): CookieOptions {
    return { ...this.base(), path: '/', maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000 };
  }

  refreshCookie(): CookieOptions {
    return { ...this.base(), path: REFRESH_COOKIE_PATH, maxAge: this.sessionTtlMs };
  }

  visitorCookie(): CookieOptions {
    return { ...this.base(), path: '/', maxAge: VISITOR_TTL_MS };
  }

  csrfCookie(): CookieOptions {
    return { ...this.base(), path: '/' };
  }

  clearOptions(name: string): CookieOptions {
    return { ...this.base(), path: name === REFRESH_COOKIE ? REFRESH_COOKIE_PATH : '/' };
  }
}
