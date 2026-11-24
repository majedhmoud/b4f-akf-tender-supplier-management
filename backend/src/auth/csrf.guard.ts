import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CsrfService } from './csrf.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Every POST, PUT, PATCH, and DELETE needs a valid X-CSRF-Token, including
// guest forms and sign-in (API_CONTRACT.md §1.1). Runs after authentication,
// so an expired session still answers 401 first (§1.4).
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly csrf: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!SAFE_METHODS.has(request.method)) this.csrf.assertValid(request);
    return true;
  }
}
