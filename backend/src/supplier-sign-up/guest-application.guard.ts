import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AccessService } from '../auth/access.service.js';
import { ACCESS_COOKIE } from '../auth/auth.settings.js';

@Injectable()
export class GuestApplicationGuard implements CanActivate {
  constructor(private readonly access: AccessService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    await this.access.guestApplication(request.cookies?.[ACCESS_COOKIE]);
    return true;
  }
}
