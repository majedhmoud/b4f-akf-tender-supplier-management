import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { notFound } from '../auth/access.service.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { BidsService } from './bids.service.js';

// Runs before the upload interceptor, so a tender or bid the supplier cannot
// see answers 404 before any file is read into memory (B2, B4). Guards run
// before interceptors in NestJS; the service repeats the checks in its
// transaction.
@Injectable()
export class BidAccessGuard implements CanActivate {
  constructor(private readonly bids: BidsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const userId = req.user?.id;
    const { tenderId, bidId } = req.params as { tenderId?: string; bidId?: string };
    if (!userId) throw notFound();
    if (tenderId !== undefined) {
      if (!isUUID(tenderId)) throw notFound();
      await this.bids.assertCanSeeTender(userId, tenderId);
    } else if (bidId !== undefined) {
      if (!isUUID(bidId)) throw notFound();
      await this.bids.assertOwnBid(userId, bidId);
    }
    return true;
  }
}
