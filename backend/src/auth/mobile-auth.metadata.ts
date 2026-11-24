import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export const MOBILE_AUTH_BODY = Symbol('mobile-auth-body');
export const MOBILE_BID_READ = Symbol('mobile-bid-read');
export const USE_MOBILE_BEARER = Symbol('use-mobile-bearer');

export const MobileAuthBody = () => SetMetadata(MOBILE_AUTH_BODY, true);
export const MobileBidRead = () => SetMetadata(MOBILE_BID_READ, true);
export type SessionRequest = Request & { [USE_MOBILE_BEARER]?: boolean };

export function hasSupplierAccess(user: {
  roles: readonly { role: string }[];
  supplier: { id: string } | null;
}): boolean {
  return user.supplier !== null && user.roles.some(({ role }) => role === 'supplier');
}
