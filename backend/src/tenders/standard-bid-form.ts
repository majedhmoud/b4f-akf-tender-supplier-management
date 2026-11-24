import type { PartType } from '../generated/prisma/client.js';

// The standard fields and documents every tender's bid form starts with
// (ERD, Supplier bid form), as in the B1 example of API_CONTRACT.md, Bids.
// Custom fields supplement them and never replace them.

export interface StandardField {
  name: string;
  type: 'text';
  required: boolean;
  maxLength: number;
}

export interface StandardDocument {
  kind: string;
  required: boolean;
}

export const PART_TYPES: PartType[] = ['legal_information', 'technical_offer', 'financial_offer'];

export const STANDARD_BID_FORM: Record<
  PartType,
  { fields: StandardField[]; documents: StandardDocument[] }
> = {
  legal_information: {
    fields: [{ name: 'authorizedSignatoryName', type: 'text', required: true, maxLength: 120 }],
    documents: [{ kind: 'registration_certificate', required: true }],
  },
  technical_offer: {
    fields: [],
    documents: [{ kind: 'technical_proposal', required: true }],
  },
  financial_offer: {
    fields: [],
    documents: [{ kind: 'financial_proposal', required: true }],
  },
};
