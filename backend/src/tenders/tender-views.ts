import type { TenderDocumentView, TenderDeadlines } from './dto/employee-tender.dto.js';

// Shared mapping from database rows to the views in the API contract, used by
// every tender audience.

export function toDeadlines(tender: {
  applicationDeadline: Date | null;
  technicalDeadline: Date | null;
  financialDeadline: Date | null;
}): TenderDeadlines | null {
  if (!tender.applicationDeadline || !tender.technicalDeadline || !tender.financialDeadline) {
    return null;
  }
  return {
    application: tender.applicationDeadline.toISOString(),
    technical: tender.technicalDeadline.toISOString(),
    financial: tender.financialDeadline.toISOString(),
  };
}

// Selects a tender's documents with their translations. Original file names
// are fine here: these views are for staff, not blind reviewers
// (API_CONTRACT.md §1.8).
export const tenderDocumentsInclude = {
  select: {
    kind: true,
    document: {
      select: {
        id: true,
        originalName: true,
        language: true,
        translationOfId: true,
        translations: { select: { id: true, originalName: true, language: true } },
      },
    },
  },
} as const;

interface TenderDocumentRow {
  kind: string;
  document: {
    id: string;
    originalName: string;
    language: string;
    translationOfId: string | null;
    translations: { id: string; originalName: string; language: string }[];
  };
}

// Lists originals, each with its translated copies.
export function toDocumentViews(rows: TenderDocumentRow[]): TenderDocumentView[] {
  return rows
    .filter((row) => row.document.translationOfId === null)
    .map((row) => ({
      id: row.document.id,
      kind: row.kind,
      name: row.document.originalName,
      language: row.document.language,
      translations: row.document.translations.map((t) => ({
        id: t.id,
        name: t.originalName,
        language: t.language,
      })),
    }));
}
