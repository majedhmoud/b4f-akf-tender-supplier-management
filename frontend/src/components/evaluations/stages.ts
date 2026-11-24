import {
  getFinancialEvaluationsDetailUrl,
  getFinancialEvaluationsDownloadUrl,
  getFinancialEvaluationsQueueUrl,
  getFinancialEvaluationsSubmitUrl,
  getLegalEvaluationsDetailUrl,
  getLegalEvaluationsDownloadUrl,
  getLegalEvaluationsQueueUrl,
  getLegalEvaluationsSubmitUrl,
  getTechnicalEvaluationsDetailUrl,
  getTechnicalEvaluationsDownloadUrl,
  getTechnicalEvaluationsQueueUrl,
  getTechnicalEvaluationsSubmitUrl,
} from '@/lib/api/generated/evaluations/evaluations';
import type { CommitteeType } from '@/lib/api/generated/model';

// The three sealed stages (API_CONTRACT.md, Evaluation). Legal works by bid ID
// and sees supplier names; technical and financial work by bidder code only.
export const STAGES = ['legal', 'technical', 'financial'] as const;
export type Stage = (typeof STAGES)[number];

export const isStage = (value: string): value is Stage =>
  (STAGES as readonly string[]).includes(value);

export const STAGE_OF: Record<CommitteeType, Stage> = {
  legal_committee: 'legal',
  technical_committee: 'technical',
  financial_committee: 'financial',
};

export const STAGE_URLS: Record<
  Stage,
  {
    queue: (tenderId: string, params: { page: number; limit: number }) => string;
    detail: (tenderId: string, ref: string) => string;
    submit: (tenderId: string, ref: string) => string;
    download: (tenderId: string, ref: string, docId: string) => string;
  }
> = {
  legal: {
    queue: getLegalEvaluationsQueueUrl,
    detail: getLegalEvaluationsDetailUrl,
    submit: getLegalEvaluationsSubmitUrl,
    download: getLegalEvaluationsDownloadUrl,
  },
  technical: {
    queue: getTechnicalEvaluationsQueueUrl,
    detail: getTechnicalEvaluationsDetailUrl,
    submit: getTechnicalEvaluationsSubmitUrl,
    download: getTechnicalEvaluationsDownloadUrl,
  },
  financial: {
    queue: getFinancialEvaluationsQueueUrl,
    detail: getFinancialEvaluationsDetailUrl,
    submit: getFinancialEvaluationsSubmitUrl,
    download: getFinancialEvaluationsDownloadUrl,
  },
};
