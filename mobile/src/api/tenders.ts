import { apiOrigin } from '@/config/env';
import type { Locale } from '@/locale/messages';
import { getJson } from './client';

export type TenderSummary = {
  id: string;
  categoryCode: string;
  content: { language: Locale; title: string };
  isFallback: boolean;
  applicationDeadline: string;
};

type TenderPage = { data: TenderSummary[]; meta: { totalPages: number } };
type FileVersion = { id: string; name: string; language: string };

export type TenderDetail = Omit<
  TenderSummary,
  'content' | 'applicationDeadline'
> & {
  content: TenderSummary['content'] & { description: string };
  deadlines: Record<'application' | 'technical' | 'financial', string>;
  documents: (FileVersion & { kind: string; translations: FileVersion[] })[];
};

export async function listTenders(locale: Locale, signal: AbortSignal) {
  const path = (page: number) => `/tenders?page=${page}&limit=100`;
  const first = await getJson<TenderPage>(path(1), locale, signal);
  const tenders = new Map(first.data.map((item) => [item.id, item]));
  // T1 has no text search parameter, so include all pages in local search.
  for (let page = 2; page <= first.meta.totalPages; page++) {
    const result = await getJson<TenderPage>(path(page), locale, signal);
    for (const item of result.data) tenders.set(item.id, item);
  }
  return [...tenders.values()];
}

export async function getTender(
  tenderId: string,
  locale: Locale,
  signal: AbortSignal,
) {
  const [tender, clock] = await Promise.all([
    getJson<TenderDetail>(`/tenders/${tenderId}`, locale, signal),
    // Cached tender data cannot anchor countdowns. A0 supplies uncached server time.
    getJson<{ serverTime: string }>('/auth/csrf', locale, signal).then(
      ({ serverTime }) => ({
        serverMs: Date.parse(serverTime),
        receivedAt: performance.now(),
      }),
    ),
  ]);
  return { tender, clock };
}

export async function getTenderDownload(
  tenderId: string,
  documentId: string,
  locale: Locale,
) {
  const { url } = await getJson<{ url: string }>(
    `/tenders/${tenderId}/documents/${encodeURIComponent(documentId)}/download`,
    locale,
  );
  const origin = apiOrigin();
  const download = new URL(url, origin);
  if (
    download.origin !== origin ||
    !download.pathname.startsWith('/api/v1/files/')
  ) {
    throw new Error('Unexpected download URL.');
  }
  return download.toString();
}
