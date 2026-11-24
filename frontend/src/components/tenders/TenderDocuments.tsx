'use client';

import { Download, FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { TenderDocumentView } from '@/lib/api/generated/model';
import { publicTendersDownload } from '@/lib/api/generated/public-tenders/public-tenders';
import { apiUrl } from '@/lib/api/mutator';
import { languageName } from '@/lib/format';

// Terms of Reference with their translated copies. A download asks the API for
// a short-lived signed URL, then opens it (ADR 0006, API_CONTRACT.md §1.8).
export function TenderDocuments({
  tenderId,
  documents,
}: {
  tenderId: string;
  documents: TenderDocumentView[];
}) {
  const t = useTranslations('Tender');
  const locale = useLocale();
  const [failed, setFailed] = useState(false);

  async function download(documentId: string) {
    setFailed(false);
    try {
      const link = await publicTendersDownload(tenderId, documentId);
      window.location.assign(apiUrl(link.url));
    } catch {
      setFailed(true);
    }
  }

  if (documents.length === 0) {
    return <p className="text-muted-foreground text-sm">{t('noDocuments')}</p>;
  }

  const files = documents.flatMap((doc) => [
    { id: doc.id, name: doc.name, language: doc.language, isTranslation: false },
    ...doc.translations.map((tr) => ({ ...tr, isTranslation: true })),
  ]);

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 sm:flex-nowrap"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <FileText aria-hidden="true" className="size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="break-words text-sm font-medium" dir="auto">
                  {file.name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t('fileLanguage', { language: languageName(locale, file.language) })}
                  {file.isTranslation && ` · ${t('translatedCopy')}`}
                </p>
              </div>
            </div>
            <Button
              className="bg-card"
              variant="outline"
              size="sm"
              onClick={() => download(file.id)}
            >
              <Download aria-hidden="true" className="size-4" />
              {t('download')}
            </Button>
          </li>
        ))}
      </ul>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t('downloadFailed')}
        </p>
      )}
    </div>
  );
}
