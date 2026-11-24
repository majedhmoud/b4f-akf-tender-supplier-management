import { HttpStatus } from '@nestjs/common';
import { ApiException, type FieldError } from '../common/errors/api-exception.js';
import type { TenderRef } from '../auth/access.service.js';
import type { Prisma, TenderStatus } from '../generated/prisma/client.js';

// Shared rules for every change to a tender, from any audience.

export function statusChanged(currentStatus: TenderStatus): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    'TENDER_STATUS_CHANGED',
    'Tender status changed',
    undefined,
    { currentStatus },
  );
}

export function versionConflict(currentRevision: number): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    'VERSION_CONFLICT',
    'Tender was changed',
    undefined,
    { currentRevision },
  );
}

export function fieldErrors(fields: FieldError[]): ApiException {
  return new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid fields', fields);
}

export function invalidField(field: string, code = 'INVALID'): ApiException {
  return fieldErrors([{ field, code }]);
}

// Steps 3 and 4 of API_CONTRACT.md §1.4, after the visibility check: the
// status must allow the change, then the revision the client sent must be
// current. A missing or malformed revision is left to field validation.
export function assertEditable(
  tender: TenderRef,
  allowed: TenderStatus,
  sentRevision: unknown,
): void {
  if (tender.status !== allowed) throw statusChanged(tender.status);
  const revision = typeof sentRevision === 'string' ? Number(sentRevision) : sentRevision;
  if (Number.isInteger(revision) && revision !== tender.revision) {
    throw versionConflict(tender.revision);
  }
}

// Increases the revision only if nobody changed the status or revision since
// the checks (ERD, Tender revision). Call inside the change's transaction.
export async function bumpRevision(
  tx: Prisma.TransactionClient,
  tenderId: string,
  expected: { status: TenderStatus; revision: number },
  data: Prisma.TenderUncheckedUpdateManyInput = {},
): Promise<number> {
  const saved = await tx.tender.updateMany({
    where: { id: tenderId, status: expected.status, revision: expected.revision },
    data: { ...data, revision: { increment: 1 } },
  });
  if (saved.count !== 1) {
    const current = await tx.tender.findUniqueOrThrow({
      where: { id: tenderId },
      select: { status: true, revision: true },
    });
    throw current.status !== expected.status
      ? statusChanged(current.status)
      : versionConflict(current.revision);
  }
  return expected.revision + 1;
}

export async function assertCategoryExists(tx: Prisma.TransactionClient, code: string) {
  const category = await tx.tenderCategory.findUnique({ where: { code } });
  if (!category) throw invalidField('categoryCode');
}

export function assertOneTranslationPerLanguage(translations: { language: string }[]) {
  const languages = new Set(translations.map((t) => t.language));
  if (languages.size !== translations.length) throw invalidField('translations');
}
