import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '../../generated/prisma/client.js';

// The signed-in user, attached by the authentication guard after it checked
// the session. Never take the user from the request body
// (ENGINEERING_STANDARDS.md §2.7).
export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  roles: Role[];
  sessionChannel?: 'mobile';
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser =>
    ctx.switchToHttp().getRequest<Request>().user as AuthenticatedUser,
);
