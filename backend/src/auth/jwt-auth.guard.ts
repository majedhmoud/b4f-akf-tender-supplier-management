import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import { ApiException } from '../common/errors/api-exception.js';
import { MOBILE_BID_READ, USE_MOBILE_BEARER, type SessionRequest } from './mobile-auth.metadata.js';

// Global guard: every endpoint needs a valid session unless marked @Public()
// (ENGINEERING_STANDARDS.md §2.2). Tells an expired access token apart from a
// missing one, so the web app knows when to refresh (API_CONTRACT.md §1.5).
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<SessionRequest>();
    request[USE_MOBILE_BEARER] =
      request.method === 'GET' &&
      this.reflector.get<boolean>(MOBILE_BID_READ, context.getHandler()) === true &&
      request.headers.authorization !== undefined;
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: unknown, user: TUser, info: unknown): TUser {
    // The strategy throws ApiException; anything else is an unexpected error.
    if (err instanceof Error) throw err;
    if (err) throw new Error('Authentication failed');
    if (user) return user;
    // Compared by name: passport-jwt may load its own copy of jsonwebtoken.
    if (info instanceof Error && info.name === 'TokenExpiredError') {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'SESSION_EXPIRED', 'Access token expired');
    }
    throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Sign-in required');
  }
}
