import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { Observable } from 'rxjs';

const PUBLIC_CACHE_KEY = 'publicCache';

export const PRIVATE_NO_STORE = 'private, no-store';

// Marks one of the few responses that may be cached publicly for 60 seconds:
// GET /tenders, GET /tenders/:tenderId, and GET /reference/… (API_CONTRACT.md
// §1.2). Name each endpoint explicitly; never a path prefix
// (ENGINEERING_STANDARDS.md §6.6).
export const PublicCache = () => SetMetadata(PUBLIC_CACHE_KEY, true);

// Sets Cache-Control on every response: `private, no-store` unless the
// handler is marked @PublicCache(). Errors get `private, no-store` from the
// exception filter.
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_CACHE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      response.setHeader('Cache-Control', 'public, max-age=60');
      response.setHeader('Vary', 'Accept-Language');
    } else {
      response.setHeader('Cache-Control', PRIVATE_NO_STORE);
    }
    return next.handle();
  }
}
