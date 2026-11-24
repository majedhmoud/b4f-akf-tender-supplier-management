import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { ApiException } from '../common/errors/api-exception.js';

const ROLES_KEY = 'requiredRoles';

// A user without the role gets 404, not 403: the API never confirms that a
// record or area exists to someone who may not see it (API_CONTRACT.md §1.4,
// ENGINEERING_STANDARDS.md §6.3).
@Injectable()
export class RequireRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const user = context.switchToHttp().getRequest<Request>().user as AuthenticatedUser;
    if (roles?.some((role) => user?.roles.includes(role))) return true;
    throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
  }
}

// Allows the endpoint only for users holding one of these account roles.
export const RequireRole = (...roles: Role[]) =>
  applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(RequireRoleGuard));
