import { HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isISO6391 } from 'class-validator';
import { AccessService, notFound } from '../auth/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ApiException, type FieldError } from '../common/errors/api-exception.js';
import { validateBody } from '../common/errors/validate-body.js';
import { PageQueryDto, pageArgs, pageMeta } from '../common/pagination/pagination.js';
import { Prisma, type ApplicationDocumentKind } from '../generated/prisma/client.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { EmailQueue } from '../notifications/email-queue.js';
import { accountSetupEmail } from '../notifications/email-templates.js';
import { SetupTokens } from '../account-setup/setup-tokens.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { SignedUrlService } from '../storage/signed-url.service.js';
import { checkUpload, safeFileName, type UploadedFileInput } from '../storage/upload-rules.js';
import {
  SupplierApplicationDto,
  SignupReviewDto,
  type LegalApplicationView,
  type AdminSignupRequestView,
  type SignupAcceptResult,
} from './dto/supplier-application.dto.js';

const KINDS: ApplicationDocumentKind[] = ['registration_certificate', 'tax_certificate'];
const fields = {
  id: true,
  legalName: true,
  registrationNumber: true,
  contactEmail: true,
  preferredLanguage: true,
  submittedAt: true,
} satisfies Prisma.SupplierApplicationSelect;
function invalid(errors: FieldError[]): ApiException {
  return new ApiException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_FAILED',
    'Invalid application',
    errors,
  );
}
function alreadyAccepted(supplierId?: string): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    'ALREADY_ACCEPTED',
    'Request already accepted',
    undefined,
    { supplierId: supplierId ?? null },
  );
}
function emailRegistered(): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    'EMAIL_ALREADY_REGISTERED',
    'An account already uses this email',
  );
}
function registrationExists(): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    'REGISTRATION_NUMBER_EXISTS',
    'Registration number already registered',
  );
}
function applicationView(row: Prisma.SupplierApplicationGetPayload<{ select: typeof fields }>) {
  return {
    applicationId: row.id,
    legalName: row.legalName,
    registrationNumber: row.registrationNumber,
    contactEmail: row.contactEmail,
    preferredLanguage: row.preferredLanguage,
    submittedAt: row.submittedAt.toISOString(),
  };
}
@Injectable()
export class SupplierSignUpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly storage: FileStorage,
    private readonly signedUrls: SignedUrlService,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
    private readonly setupTokens: SetupTokens,
    private readonly emails: EmailQueue,
  ) {}

  form() {
    return {
      fields: [
        { name: 'legalName', type: 'text', required: true, maxLength: 200 },
        { name: 'registrationNumber', type: 'text', required: true, maxLength: 100 },
        { name: 'contactEmail', type: 'email', required: true, maxLength: 254 },
        { name: 'preferredLanguage', type: 'enum', values: ['en', 'ar'], required: true },
      ],
      documents: KINDS.map((kind) => ({ kind, required: true })),
    };
  }

  async submit(
    body: Record<string, unknown>,
    files: Record<string, UploadedFileInput[]>,
    scope: string,
    key: string | undefined,
    requestId?: string,
  ) {
    const allowed = ['application', 'languages'];
    const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
    if (unknown.length)
      throw invalid(unknown.map((field) => ({ field, code: 'FIELD_NOT_EDITABLE' })));
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof body.application === 'string' ? body.application : '');
    } catch {
      throw invalid([{ field: 'application', code: 'INVALID' }]);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw invalid([{ field: 'application', code: 'INVALID' }]);
    const dto = await validateBody(SupplierApplicationDto, parsed);
    const languageFields = body.languages;
    if (!languageFields || typeof languageFields !== 'object' || Array.isArray(languageFields))
      throw invalid([{ field: 'languages', code: 'REQUIRED' }]);
    const unexpectedLanguages = Object.keys(languageFields).filter(
      (kind) => !KINDS.includes(kind as ApplicationDocumentKind),
    );
    if (unexpectedLanguages.length)
      throw invalid(
        unexpectedLanguages.map((kind) => ({
          field: `languages[${kind}]`,
          code: 'FIELD_NOT_EDITABLE',
        })),
      );
    const languages = KINDS.map((kind) => (languageFields as Record<string, unknown>)[kind]);
    const errors = KINDS.flatMap((kind, i): FieldError[] => [
      ...(!files[`files[${kind}]`]?.length ? [{ field: `files[${kind}]`, code: 'REQUIRED' }] : []),
      ...(typeof languages[i] !== 'string' || !isISO6391(languages[i])
        ? [{ field: `languages[${kind}]`, code: 'INVALID' }]
        : []),
    ]);
    if (errors.length) throw invalid(errors);
    const uploads = KINDS.map((kind, i) => {
      const file = files[`files[${kind}]`][0];
      return {
        kind,
        file,
        mime: checkUpload(file),
        name: safeFileName(file.originalname),
        language: languages[i] as string,
      };
    });
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          legalName: dto.legalName,
          registrationNumber: dto.registrationNumber,
          contactEmail: dto.contactEmail,
          preferredLanguage: dto.preferredLanguage,
          files: uploads.map(({ kind, file, name, language, mime }) => ({
            kind,
            name,
            language,
            mime,
            hash: createHash('sha256').update(file.buffer).digest('hex'),
          })),
        }),
      )
      .digest('hex');
    const stored: string[] = [];
    try {
      return await this.idempotency.guest(
        scope,
        key,
        'POST /api/v1/supplier-applications',
        fingerprint,
        async (tx) => {
          if (
            await tx.supplier.findUnique({
              where: { registrationNumber: dto.registrationNumber },
              select: { id: true },
            })
          )
            throw new ApiException(
              HttpStatus.CONFLICT,
              'REGISTRATION_NUMBER_EXISTS',
              'Registration already exists',
              [{ field: 'registrationNumber', code: 'REGISTRATION_NUMBER_EXISTS' }],
            );
          // A person who already has an account signs in instead
          // (API_CONTRACT.md, Sign-up). Emails are stored lower-cased.
          if (
            await tx.userAccount.findUnique({
              where: { email: dto.contactEmail },
              select: { id: true },
            })
          )
            throw new ApiException(
              HttpStatus.CONFLICT,
              'EMAIL_ALREADY_REGISTERED',
              'An account already uses this email',
              [{ field: 'contactEmail', code: 'EMAIL_ALREADY_REGISTERED' }],
            );
          const application = await tx.supplierApplication.create({
            data: dto,
            select: { id: true, submittedAt: true },
          });
          for (const upload of uploads) {
            const storageKey = await this.storage.save(upload.file.buffer);
            stored.push(storageKey);
            await tx.document.create({
              data: {
                ownerType: 'application',
                storageKey,
                originalName: upload.name,
                language: upload.language,
                mimeType: upload.mime,
                sizeBytes: upload.file.size,
                applicationLink: { create: { applicationId: application.id, kind: upload.kind } },
              },
            });
          }
          await this.audit.record(
            {
              actorUserId: null,
              action: 'supplier_application.submitted',
              resourceType: 'supplier_application',
              resourceId: application.id,
              requestId,
            },
            tx,
          );
          return {
            applicationId: application.id,
            submittedAt: application.submittedAt.toISOString(),
          };
        },
      );
    } catch (error) {
      // Never delete referenced files after an uncertain commit acknowledgement.
      try {
        const referenced = await this.prisma.document.findMany({
          where: { storageKey: { in: stored } },
          select: { storageKey: true },
        });
        const keep = new Set(referenced.map((row) => row.storageKey));
        await Promise.all(
          stored.filter((key) => !keep.has(key)).map((key) => this.storage.delete(key)),
        );
      } catch {
        /* Retain unknown files for reconciliation when database access returns. */
      }
      throw error;
    }
  }

  async pending(query: PageQueryDto) {
    const where = { review: { is: null } } satisfies Prisma.SupplierApplicationWhereInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supplierApplication.findMany({
        where,
        ...pageArgs(query),
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        select: { id: true, legalName: true, registrationNumber: true, submittedAt: true },
      }),
      this.prisma.supplierApplication.count({ where }),
    ]);
    return {
      data: rows.map(({ id, submittedAt, ...row }) => ({
        applicationId: id,
        ...row,
        submittedAt: submittedAt.toISOString(),
      })),
      meta: pageMeta(query, total),
    };
  }
  async legalDetail(applicationId: string): Promise<LegalApplicationView> {
    await this.access.signupApplication(applicationId);
    const row = await this.prisma.supplierApplication.findUniqueOrThrow({
      where: { id: applicationId },
      select: {
        ...fields,
        documents: {
          select: {
            kind: true,
            document: { select: { id: true, originalName: true, language: true } },
          },
        },
      },
    });
    return {
      ...applicationView(row),
      documents: row.documents.map(({ kind, document }) => ({
        id: document.id,
        kind,
        name: document.originalName,
        language: document.language,
      })),
    };
  }
  async download(applicationId: string, docId: string) {
    await this.access.signupApplication(applicationId);
    const link = await this.prisma.applicationDocument.findFirst({
      where: { applicationId, documentId: docId },
      select: { document: { select: { storageKey: true, originalName: true } } },
    });
    if (!link) throw notFound();
    return this.signedUrls.sign(link.document.storageKey, link.document.originalName);
  }
  async review(applicationId: string, reviewerUserId: string, body: unknown, requestId?: string) {
    await this.access.signupApplication(applicationId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM supplier_applications WHERE id=${applicationId}::uuid FOR UPDATE`;
      const existing = await tx.signupReview.findUnique({
        where: { applicationId },
        select: { decision: true },
      });
      if (existing)
        throw new ApiException(
          HttpStatus.CONFLICT,
          'ALREADY_SUBMITTED',
          'Already reviewed',
          undefined,
          { decision: existing.decision },
        );
      const dto = await validateBody(SignupReviewDto, body);
      const now = new Date();
      const saved = await tx.signupReview.create({
        data: {
          applicationId,
          reviewerUserId,
          decision: dto.decision,
          reason: dto.reason ?? null,
          decidedAt: now,
          raisedToAdminAt: dto.decision === 'accepted' ? now : null,
        },
        select: { decision: true, raisedToAdminAt: true },
      });
      await this.audit.record(
        {
          actorUserId: reviewerUserId,
          action: 'signup_review.decided',
          resourceType: 'supplier_application',
          resourceId: applicationId,
          context: { decision: dto.decision },
          requestId,
        },
        tx,
      );
      return {
        decision: saved.decision,
        raisedToAdminAt: saved.raisedToAdminAt?.toISOString() ?? null,
      };
    });
  }
  async raised(query: PageQueryDto) {
    const where = {
      decision: 'accepted',
      raisedToAdminAt: { not: null },
      adminAcceptedAt: null,
    } satisfies Prisma.SignupReviewWhereInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.signupReview.findMany({
        where,
        ...pageArgs(query),
        orderBy: [{ raisedToAdminAt: 'asc' }, { id: 'asc' }],
        select: {
          application: {
            select: { id: true, legalName: true, registrationNumber: true, submittedAt: true },
          },
        },
      }),
      this.prisma.signupReview.count({ where }),
    ]);
    return {
      data: rows.map(({ application: { id, submittedAt, ...row } }) => ({
        applicationId: id,
        ...row,
        submittedAt: submittedAt.toISOString(),
      })),
      meta: pageMeta(query, total),
    };
  }
  async adminDetail(applicationId: string): Promise<AdminSignupRequestView> {
    await this.access.raisedSignup(applicationId);
    const row = await this.prisma.supplierApplication.findUniqueOrThrow({
      where: { id: applicationId },
      select: {
        ...fields,
        review: {
          select: {
            reviewerUserId: true,
            decision: true,
            reason: true,
            decidedAt: true,
            raisedToAdminAt: true,
          },
        },
      },
    });
    const review = row.review!;
    return {
      ...applicationView(row),
      review: {
        ...review,
        decidedAt: review.decidedAt.toISOString(),
        raisedToAdminAt: review.raisedToAdminAt!.toISOString(),
      },
    };
  }

  // U7: provisions the supplier at most once, in one transaction with the
  // first setup link and its email; delivery starts after commit (ERD, Sign-up).
  async accept(
    applicationId: string,
    adminUserId: string,
    requestId?: string,
  ): Promise<SignupAcceptResult> {
    const provisioned = await this.prisma
      .$transaction(async (tx) => {
        // The review row lock makes a simultaneous second acceptance wait,
        // then answer ALREADY_ACCEPTED.
        await tx.$queryRaw`SELECT id FROM signup_reviews WHERE application_id = ${applicationId}::uuid FOR UPDATE`;
        const review = await tx.signupReview.findFirst({
          where: { applicationId, decision: 'accepted', raisedToAdminAt: { not: null } },
          select: { id: true, adminAcceptedAt: true, application: { select: fields } },
        });
        if (!review) throw notFound();
        if (review.adminAcceptedAt) {
          const supplier = await tx.supplier.findUnique({
            where: { applicationId },
            select: { id: true },
          });
          throw alreadyAccepted(supplier?.id);
        }
        const app = review.application;
        const email = app.contactEmail.toLowerCase();
        if (await tx.userAccount.findUnique({ where: { email }, select: { id: true } })) {
          throw emailRegistered();
        }
        if (
          await tx.supplier.findUnique({
            where: { registrationNumber: app.registrationNumber },
            select: { id: true },
          })
        ) {
          throw registrationExists();
        }

        const now = new Date();
        await tx.signupReview.update({
          where: { id: review.id },
          data: { adminUserId, adminAcceptedAt: now },
        });
        const user = await tx.userAccount.create({
          data: {
            email,
            displayName: app.legalName,
            preferredLanguage: app.preferredLanguage,
            status: 'pending_setup',
            roles: { create: { role: 'supplier' } },
          },
          select: { id: true },
        });
        const supplier = await tx.supplier.create({
          data: {
            applicationId,
            userId: user.id,
            legalName: app.legalName,
            registrationNumber: app.registrationNumber,
          },
          select: { id: true },
        });
        await this.setupTokens.issue(tx, user.id);
        const message = await tx.emailMessage.create({
          data: {
            kind: 'account_setup',
            recipientUserId: user.id,
            recipientEmail: email,
            language: app.preferredLanguage,
            ...accountSetupEmail(app.preferredLanguage, app.legalName),
            status: 'sending',
          },
          select: { id: true, revision: true },
        });
        await this.audit.record(
          {
            actorUserId: adminUserId,
            action: 'signup_request.accepted',
            resourceType: 'supplier_application',
            resourceId: applicationId,
            context: { supplierId: supplier.id },
            requestId,
          },
          tx,
        );
        await this.audit.record(
          {
            actorUserId: adminUserId,
            action: 'supplier_account.created',
            resourceType: 'user_account',
            resourceId: user.id,
            context: { supplierId: supplier.id, applicationId },
            requestId,
          },
          tx,
        );
        return { supplierId: supplier.id, message, language: app.preferredLanguage };
      })
      .catch((error: unknown) => {
        // Another application took the email or number in the same moment.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const target = JSON.stringify(error.meta ?? {});
          throw target.includes('registration') ? registrationExists() : emailRegistered();
        }
        throw error;
      });

    await this.emails.enqueue(provisioned.message.id, provisioned.message.revision);
    return {
      supplierId: provisioned.supplierId,
      accountStatus: 'pending_setup',
      setupEmail: { language: provisioned.language, status: 'sending' },
    };
  }
}
