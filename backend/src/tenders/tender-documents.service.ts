import { Injectable } from '@nestjs/common';
import { AccessService, notFound } from '../auth/access.service.js';
import { validateBody } from '../common/errors/validate-body.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { SignedUrlService, type SignedDownload } from '../storage/signed-url.service.js';
import { checkUpload, safeFileName, type UploadedFileInput } from '../storage/upload-rules.js';
import type { TenderRevision } from './dto/employee-tender.dto.js';
import { RemoveDocumentQueryDto, UploadTenderDocumentDto } from './dto/manage-input.dto.js';
import type { UploadedDocumentResult } from './dto/managed-tender.dto.js';
import { assertEditable, bumpRevision, fieldErrors, invalidField } from './tender-rules.js';

// Terms of Reference and other tender files: M5–M7 for the officer, Q5 for
// the requesting employee (API_CONTRACT.md §2, §1.8; ERD, Document ownership).
@Injectable()
export class TenderDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly storage: FileStorage,
    private readonly signedUrls: SignedUrlService,
  ) {}

  // M5. While `accepted`. One original per kind; translated copies point to
  // their original and use another language.
  async upload(
    userId: string,
    tenderId: string,
    body: unknown,
    file: UploadedFileInput | undefined,
  ): Promise<UploadedDocumentResult> {
    const tender = await this.access.managedTender(tenderId);
    assertEditable(tender, 'accepted', (body as { revision?: unknown } | null)?.revision);
    const dto = await validateBody(UploadTenderDocumentDto, body);
    if (!file) throw fieldErrors([{ field: 'file', code: 'REQUIRED' }]);
    const mimeType = checkUpload(file);

    if (dto.translationOf) {
      const original = await this.prisma.tenderDocument.findFirst({
        where: { tenderId, documentId: dto.translationOf, document: { translationOfId: null } },
        select: { kind: true, document: { select: { language: true } } },
      });
      if (!original || original.kind !== dto.kind) throw invalidField('translationOf');
      if (original.document.language === dto.language) {
        throw invalidField('language', 'TRANSLATION_SAME_LANGUAGE');
      }
    } else {
      const existing = await this.prisma.tenderDocument.count({
        where: { tenderId, kind: dto.kind, document: { translationOfId: null } },
      });
      if (existing > 0) throw invalidField('kind', 'ALREADY_UPLOADED');
    }

    const name = safeFileName(file.originalname);
    const storageKey = await this.storage.save(file.buffer);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const revision = await bumpRevision(tx, tenderId, {
          status: 'accepted',
          revision: dto.revision,
        });
        const document = await tx.document.create({
          data: {
            ownerType: 'tender',
            storageKey,
            originalName: name,
            mimeType,
            sizeBytes: file.size,
            language: dto.language,
            translationOfId: dto.translationOf ?? null,
            uploadedByUserId: userId,
            tenderLink: { create: { tenderId, kind: dto.kind } },
          },
          select: { id: true, originalName: true, language: true, translationOfId: true },
        });
        return {
          document: {
            id: document.id,
            kind: dto.kind,
            name: document.originalName,
            language: document.language,
            translationOf: document.translationOfId,
          },
          revision,
        };
      });
    } catch (error) {
      await this.storage.delete(storageKey);
      // A second translation in the same language (ERD, Language).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw invalidField('language', 'ALREADY_UPLOADED');
      }
      throw error;
    }
  }

  // M6. While `accepted`. Removing an original removes its translations.
  async remove(tenderId: string, documentId: string, query: unknown): Promise<TenderRevision> {
    const tender = await this.access.managedTender(tenderId);
    const link = await this.prisma.tenderDocument.findFirst({
      where: { tenderId, documentId },
      select: {
        document: { select: { storageKey: true, translations: { select: { storageKey: true } } } },
      },
    });
    if (!link) throw notFound();
    assertEditable(tender, 'accepted', (query as { revision?: unknown } | null)?.revision);
    const dto = await validateBody(RemoveDocumentQueryDto, query);

    const revision = await this.prisma.$transaction(async (tx) => {
      const next = await bumpRevision(tx, tenderId, {
        status: 'accepted',
        revision: dto.revision,
      });
      await tx.document.delete({ where: { id: documentId } });
      return next;
    });

    const keys = [link.document.storageKey, ...link.document.translations.map((t) => t.storageKey)];
    await Promise.all(keys.map((key) => this.storage.delete(key)));
    return { revision };
  }

  // M7: the officer may download any tender file.
  async managedDownload(tenderId: string, documentId: string): Promise<SignedDownload> {
    await this.access.managedTender(tenderId);
    return this.download(tenderId, documentId);
  }

  // Q5: the employee may download files of their own tenders.
  async employeeDownload(
    userId: string,
    tenderId: string,
    documentId: string,
  ): Promise<SignedDownload> {
    await this.access.employeeTender(userId, tenderId);
    return this.download(tenderId, documentId);
  }

  // Staff downloads keep the original file name (API_CONTRACT.md §1.8).
  private async download(tenderId: string, documentId: string): Promise<SignedDownload> {
    const link = await this.prisma.tenderDocument.findFirst({
      where: { tenderId, documentId },
      select: { document: { select: { storageKey: true, originalName: true } } },
    });
    if (!link) throw notFound();
    return this.signedUrls.sign(link.document.storageKey, link.document.originalName);
  }
}
