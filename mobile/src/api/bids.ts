import type { Locale } from '@/locale/messages';
import { getPrivateJson } from './client';

type PartType = 'legal_information' | 'technical_offer' | 'financial_offer';
type TenderRef = {
  status:
    | 'draft'
    | 'accepted'
    | 'published'
    | 'closed'
    | 'under_evaluation'
    | 'awarded'
    | 'cancelled';
  content: { language: Locale; title: string };
};
type BidListItem = {
  bidId: string;
  tender: TenderRef;
  nextDeadline: string | null;
  lockedParts: PartType[];
};
type BidPage = { data: BidListItem[]; meta: { totalPages: number } };
type MobileSupplierBid = {
  id: string;
  tender: TenderRef;
  parts: { partType: PartType; deadline: string | null; locked: boolean }[];
};

export async function listMyBids(
  token: string,
  locale: Locale,
  signal: AbortSignal,
) {
  const load = (page: number) =>
    getPrivateJson<BidPage>(
      `/me/bids?page=${page}&limit=100`,
      token,
      locale,
      signal,
    );
  const first = await load(1);
  const bids = new Map(first.data.map((bid) => [bid.bidId, bid]));
  for (let page = 2; page <= first.meta.totalPages; page++) {
    for (const bid of (await load(page)).data) bids.set(bid.bidId, bid);
  }
  return [...bids.values()];
}

export function getMyBid(
  bidId: string,
  token: string,
  locale: Locale,
  signal: AbortSignal,
) {
  return getPrivateJson<MobileSupplierBid>(
    `/me/bids/${encodeURIComponent(bidId)}`,
    token,
    locale,
    signal,
  );
}
