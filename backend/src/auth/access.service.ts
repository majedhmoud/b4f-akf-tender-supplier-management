import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { TenderStatus } from '../generated/prisma/client.js';
import { ApiException } from '../common/errors/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface TenderRef {
  id: string;
  status: TenderStatus;
  revision: number;
}

export function notFound(): ApiException {
  return new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
}

// The single place that decides who may see which tender (ADR 0004,
// ENGINEERING_STANDARDS.md §2.2). Anything a user may not see is 404, checked
// before any status or revision detail (API_CONTRACT.md §1.4).
@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async guestApplication(accessToken: unknown): Promise<void> {
    if (typeof accessToken !== 'string') return;
    let payload: { sub?: string; sid?: string };
    try {
      payload = this.jwt.verify(accessToken, { ignoreExpiration: true });
    } catch {
      return;
    }
    if (!payload.sid || !payload.sub) return;
    const signedIn = await this.prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: 'active' },
      },
      select: { id: true },
    });
    if (signedIn) throw notFound();
  }

  async signupApplication(applicationId: string): Promise<void> {
    const application = await this.prisma.supplierApplication.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    if (!application) throw notFound();
  }

  async raisedSignup(applicationId: string): Promise<void> {
    const raised = await this.prisma.signupReview.findFirst({
      where: { applicationId, decision: 'accepted', raisedToAdminAt: { not: null } },
      select: { id: true },
    });
    if (!raised) throw notFound();
  }

  // An employee sees only the tenders they requested (capability matrix).
  async employeeTender(userId: string, tenderId: string): Promise<TenderRef> {
    const tender = await this.prisma.tender.findFirst({
      where: { id: tenderId, requestedByUserId: userId },
      select: { id: true, status: true, revision: true },
    });
    if (!tender) throw notFound();
    return tender;
  }

  // The procurement officer sees every tender, in every status (capability
  // matrix). The role itself is checked by RequireRole on the controller.
  async managedTender(tenderId: string): Promise<TenderRef> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, status: true, revision: true },
    });
    if (!tender) throw notFound();
    return tender;
  }
}
