import { HttpStatus, Injectable } from '@nestjs/common';
import { SetupTokens } from '../account-setup/setup-tokens.js';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/errors/api-exception.js';
import { Prisma } from '../generated/prisma/client.js';
import { EmailQueue } from '../notifications/email-queue.js';
import { employeeSetupEmail } from '../notifications/email-templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateEmployeeDto, CreatedEmployee } from './dto/create-employee.dto.js';

@Injectable()
export class EmployeeAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: SetupTokens,
    private readonly audit: AuditService,
    private readonly emails: EmailQueue,
  ) {}

  async create(
    adminId: string,
    { displayName, email: enteredEmail, preferredLanguage }: CreateEmployeeDto,
    requestId?: string,
  ): Promise<CreatedEmployee> {
    const email = enteredEmail.toLowerCase();
    const { account, message } = await this.prisma.$transaction(async (tx) => {
      const account = await tx.userAccount
        .create({
          data: {
            displayName,
            email,
            preferredLanguage,
            status: 'pending_setup',
            roles: { create: { role: 'employee' } },
          },
          select: { id: true, email: true },
        })
        .catch((error: unknown) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ApiException(
              HttpStatus.CONFLICT,
              'EMAIL_ALREADY_REGISTERED',
              'Email is already registered',
            );
          }
          throw error;
        });
      await this.tokens.issue(tx, account.id);
      const message = await tx.emailMessage.create({
        data: {
          kind: 'account_setup',
          recipientUserId: account.id,
          recipientEmail: email,
          language: preferredLanguage,
          ...employeeSetupEmail(preferredLanguage, displayName),
          status: 'sending',
        },
        select: { id: true, revision: true },
      });
      await this.audit.record(
        {
          actorUserId: adminId,
          action: 'employee_account.created',
          resourceType: 'user_account',
          resourceId: account.id,
          requestId,
        },
        tx,
      );
      return { account, message };
    });
    await this.emails.enqueue(message.id, message.revision);
    return { ...account, status: 'pending_setup' };
  }
}
