import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { isISO6391 } from 'class-validator';
import { notFound } from '../auth/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/errors/api-exception.js';
import { validateBody } from '../common/errors/validate-body.js';
import { pageArgs, pageMeta } from '../common/pagination/pagination.js';
import { Prisma, type SupplierStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { SignedUrlService } from '../storage/signed-url.service.js';
import { discardUnreferenced } from '../storage/discard-unreferenced.js';
import { checkUpload, safeFileName, type UploadedFileInput } from '../storage/upload-rules.js';
import {
  CERTIFICATE_KINDS,
  EDITABLE_FIELDS,
  type SupplierCertificate,
  SupplierProfileUpdateDto,
  type SupplierListItem,
  type SupplierPage,
  type SupplierProfile,
  type SupplierQueryDto,
} from './dto/supplier.dto.js';

const profileSelect = {
  id: true,
  legalName: true,
  registrationNumber: true,
  status: true,
  technicalInformation: true,
} satisfies Prisma.SupplierSelect;
type ProfileRow = Prisma.SupplierGetPayload<{ select: typeof profileSelect }>;

const fileSelect = {
  id: true,
  originalName: true,
  language: true,
  uploadedAt: true,
} satisfies Prisma.DocumentSelect;
const certificateSelect = {
  applicationId: true,
  documents: { select: { kind: true, document: { select: fileSelect } } },
  application: {
    select: { documents: { select: { kind: true, document: { select: fileSelect } } } },
  },
} satisfies Prisma.SupplierSelect;
type CertificateRow = Prisma.SupplierGetPayload<{ select: typeof certificateSelect }>;
type FileRow = Prisma.DocumentGetPayload<{ select: typeof fileSelect }>;

// The current file per kind: the supplier's replacement, else the reviewed one.
function certificates(row: CertificateRow): SupplierCertificate[] {
  const view = (
    kind: SupplierCertificate['kind'],
    file: FileRow,
    source: 'sign_up' | 'updated',
  ) => ({
    id: file.id,
    kind,
    name: file.originalName,
    language: file.language,
    uploadedAt: file.uploadedAt.toISOString(),
    source,
  });
  return CERTIFICATE_KINDS.flatMap((kind) => {
    const updated = row.documents.find((d) => d.kind === kind);
    if (updated) return [view(kind, updated.document, 'updated')];
    const reviewed = row.application.documents.find((d) => d.kind === kind);
    return reviewed ? [view(kind, reviewed.document, 'sign_up')] : [];
  });
}

function profileView(row: ProfileRow, files: CertificateRow): SupplierProfile {
  return {
    ...row,
    certificates: certificates(files),
    technicalDocuments: [],
    editableFields: [...EDITABLE_FIELDS],
  };
}

function invalid(field: string, code: string): ApiException {
  return new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid document', [
    { field, code },
  ]);
}

function registrationExists(): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    'REGISTRATION_NUMBER_EXISTS',
    'Registration number already registered',
    [{ field: 'registrationNumber', code: 'REGISTRATION_NUMBER_EXISTS' }],
  );
}

function listItem(row: ProfileRow): SupplierListItem {
  const { technicalInformation: _, ...rest } = row;
  void _;
  return { ...rest, allowedActions: [row.status === 'active' ? 'suspend' : 'reactivate'] };
}

// P1, P2, P4 and P5 (API_CONTRACT.md, Suppliers). Suspension blocks new bids
// only; a suspended supplier still signs in and edits its profile (ERD A14).
@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: FileStorage,
    private readonly signedUrls: SignedUrlService,
  ) {}

  async ownProfile(userId: string): Promise<SupplierProfile> {
    const row = await this.prisma.supplier.findUnique({
      where: { userId },
      select: { ...profileSelect, ...certificateSelect },
    });
    if (!row) throw notFound();
    return profileView(row, row);
  }

  // P3d: only a file the profile lists, so a supplier never reaches another's.
  async download(userId: string, docId: string) {
    const row = await this.prisma.supplier.findUnique({
      where: { userId },
      select: certificateSelect,
    });
    if (!row || !certificates(row).some((c) => c.id === docId)) throw notFound();
    const file = await this.prisma.document.findUniqueOrThrow({
      where: { id: docId },
      select: { storageKey: true, originalName: true },
    });
    return this.signedUrls.sign(file.storageKey, file.originalName);
  }

  // P3 for certificates: the new file replaces the current one of its kind.
  // The reviewed application file is never touched (ERD, Sign-up).
  async replaceCertificate(
    userId: string,
    body: unknown,
    file: UploadedFileInput | undefined,
    requestId?: string,
  ): Promise<SupplierProfile> {
    const fields = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const unknown = Object.keys(fields).filter((f) => !['kind', 'language'].includes(f));
    if (unknown.length) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Field not editable',
        unknown.map((field) => ({ field, code: 'FIELD_NOT_EDITABLE' })),
      );
    }
    const kind = CERTIFICATE_KINDS.find((k) => k === fields.kind);
    if (!kind) throw invalid('kind', fields.kind === undefined ? 'REQUIRED' : 'INVALID');
    const language = fields.language;
    if (typeof language !== 'string' || !isISO6391(language)) {
      throw invalid('language', language === undefined ? 'REQUIRED' : 'INVALID');
    }
    if (!file) throw invalid('file', 'REQUIRED');
    const mimeType = checkUpload(file);

    const storageKey = await this.storage.save(file.buffer);
    let replacedKey: string | null = null;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM suppliers WHERE user_id = ${userId}::uuid FOR UPDATE`;
        const supplier = await tx.supplier.findUnique({
          where: { userId },
          select: { id: true, ...certificateSelect },
        });
        if (!supplier) throw notFound();
        const before = certificates(supplier).find((c) => c.kind === kind);
        const previous = supplier.documents.find((d) => d.kind === kind);
        if (previous) {
          const old = await tx.document.delete({
            where: { id: previous.document.id },
            select: { storageKey: true },
          });
          replacedKey = old.storageKey;
        }
        const created = await tx.document.create({
          data: {
            ownerType: 'supplier',
            storageKey,
            originalName: safeFileName(file.originalname),
            mimeType,
            sizeBytes: file.size,
            language,
            uploadedByUserId: userId,
            supplierLink: { create: { supplierId: supplier.id, kind } },
          },
          select: { id: true },
        });
        await this.audit.record(
          {
            actorUserId: userId,
            action: 'supplier.certificate_replaced',
            resourceType: 'supplier',
            resourceId: supplier.id,
            context: { kind, beforeDocumentId: before?.id ?? null, afterDocumentId: created.id },
            requestId,
          },
          tx,
        );
      });
    } catch (error) {
      await discardUnreferenced(this.prisma, this.storage, [storageKey], this.logger);
      throw error;
    }
    if (replacedKey) {
      await this.storage
        .delete(replacedKey)
        .catch(() => this.logger.warn('A replaced certificate file was not removed'));
    }
    return this.ownProfile(userId);
  }

  async updateOwnProfile(
    userId: string,
    body: unknown,
    requestId?: string,
  ): Promise<SupplierProfile> {
    const fields = body && typeof body === 'object' ? Object.keys(body) : [];
    const unknown = fields.filter((f) => !(EDITABLE_FIELDS as readonly string[]).includes(f));
    if (unknown.length) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Field not editable',
        unknown.map((field) => ({ field, code: 'FIELD_NOT_EDITABLE' })),
      );
    }
    const dto = await validateBody(SupplierProfileUpdateDto, body);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM suppliers WHERE user_id = ${userId}::uuid FOR UPDATE`;
        const before = await tx.supplier.findUnique({ where: { userId }, select: profileSelect });
        if (!before) throw notFound();
        if (
          dto.registrationNumber !== undefined &&
          dto.registrationNumber !== before.registrationNumber &&
          (await tx.supplier.findUnique({
            where: { registrationNumber: dto.registrationNumber },
            select: { id: true },
          }))
        ) {
          throw registrationExists();
        }
        const after = await tx.supplier.update({
          where: { id: before.id },
          // The account's display name follows the legal name (ERD, Sign-up).
          data: {
            ...dto,
            ...(dto.legalName !== undefined
              ? { user: { update: { displayName: dto.legalName } } }
              : {}),
          },
          select: { ...profileSelect, ...certificateSelect },
        });
        // Legal changes keep the values before and after (ENGINEERING_STANDARDS.md §8).
        const changed = (['legalName', 'registrationNumber'] as const).filter(
          (field) => before[field] !== after[field],
        );
        if (changed.length) {
          await this.audit.record(
            {
              actorUserId: userId,
              action: 'supplier.legal_information_changed',
              resourceType: 'supplier',
              resourceId: before.id,
              context: Object.fromEntries(
                changed.map((field) => [field, { before: before[field], after: after[field] }]),
              ),
              requestId,
            },
            tx,
          );
        }
        return profileView(after, after);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw registrationExists();
      }
      throw error;
    }
  }

  async list(query: SupplierQueryDto): Promise<SupplierPage> {
    const where: Prisma.SupplierWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { legalName: { contains: query.search, mode: 'insensitive' } },
              { registrationNumber: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        ...pageArgs(query),
        orderBy: [{ legalName: 'asc' }, { id: 'asc' }],
        select: profileSelect,
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return { data: rows.map(listItem), meta: pageMeta(query, total) };
  }

  // Repeating an action returns the same result and records nothing new.
  async setStatus(
    supplierId: string,
    status: SupplierStatus,
    adminUserId: string,
    requestId?: string,
  ): Promise<{ status: SupplierStatus }> {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.supplier.updateMany({
        where: { id: supplierId, status: { not: status } },
        data: { status },
      });
      if (changed.count === 0) {
        const exists = await tx.supplier.findUnique({
          where: { id: supplierId },
          select: { id: true },
        });
        if (!exists) throw notFound();
        return { status };
      }
      await this.audit.record(
        {
          actorUserId: adminUserId,
          action: status === 'suspended' ? 'supplier.suspended' : 'supplier.reactivated',
          resourceType: 'supplier',
          resourceId: supplierId,
          requestId,
        },
        tx,
      );
      return { status };
    });
  }
}
