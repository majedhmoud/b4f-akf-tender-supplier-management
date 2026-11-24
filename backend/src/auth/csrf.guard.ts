import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApiException } from '../common/errors/api-exception.js';
import { CsrfService } from './csrf.service.js';
import { MOBILE_AUTH_BODY } from './mobile-auth.metadata.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Every POST, PUT, PATCH, and DELETE needs a valid X-CSRF-Token, including
// guest forms and sign-in (API_CONTRACT.md §1.1). Runs after authentication,
// so an expired session still answers 401 first (§1.4).
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly csrf: CsrfService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    // These handlers use only explicit JSON credentials (API contract §1.9).
    if (this.reflector.get<boolean>(MOBILE_AUTH_BODY, context.getHandler())) {
      if (!request.is('application/json')) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Expected JSON body');
      }
      return true;
    }
    if (!SAFE_METHODS.has(request.method)) this.csrf.assertValid(request);
    return true;
  }
}
