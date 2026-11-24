import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { SessionUser } from '../auth/dto/session-view.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateMeDto } from './dto/update-me.dto.js';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  // Changes the interface language. Emails already prepared keep theirs
  // (ERD, Language).
  async updateMe(userId: string, dto: UpdateMeDto): Promise<SessionUser> {
    await this.prisma.userAccount.update({
      where: { id: userId },
      data: { preferredLanguage: dto.preferredLanguage },
    });
    const { user } = await this.auth.sessionView(userId);
    return user;
  }
}
