import { HttpException } from '@nestjs/common';

// One invalid field in a 400 response. `field` is a path such as
// `translations[0].title`. See API_CONTRACT.md §1.5.
export interface FieldError {
  field: string;
  code: string;
}

// Error codes the API returns. The UI translates the code and never shows the
// message. See API_CONTRACT.md §1.5 for the full list and what the UI does.
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'INVALID_CREDENTIALS'
  | 'SESSION_EXPIRED'
  | 'UNAUTHENTICATED'
  | 'SESSION_REVOKED'
  | 'ACCOUNT_PENDING_SETUP'
  | 'ACCOUNT_DISABLED'
  | 'CSRF_TOKEN_INVALID'
  | 'NOT_FOUND'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'ALREADY_ACCEPTED'
  | 'SETUP_LINK_EXPIRED'
  | 'SETUP_LINK_USED'
  | 'ASSIGNMENT_ONE_COMMITTEE_PER_TENDER'
  | 'ASSIGNMENT_REQUESTING_EMPLOYEE_CONFLICT'
  | 'ASSIGNMENT_STAFF_CONFLICT'
  | 'ASSIGNMENT_ALREADY_DECIDED'
  | 'BID_EXISTS'
  | 'SUPPLIER_SUSPENDED'
  | 'APPLICATION_CLOSED'
  | 'BID_PART_LOCKED'
  | 'TIE_BREAK_NOT_REQUIRED'
  | 'ALREADY_AWARDED'
  | 'BID_NOT_TIE_CANDIDATE'
  | 'EMAIL_NOT_EDITABLE'
  | 'TENDER_STATUS_CHANGED'
  | 'VERSION_CONFLICT'
  | 'TENDER_NOT_CANCELLED'
  | 'TENDER_ALREADY_COPIED'
  | 'FILE_TOO_LARGE'
  | 'FILE_TYPE_NOT_ALLOWED'
  | 'RATE_LIMITED'
  | 'REGISTRATION_NUMBER_EXISTS'
  | 'ALREADY_SUBMITTED'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'INTERNAL_ERROR';

// Every deliberate error goes through this class, so the global filter can
// shape it into the contract's envelope.
export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: FieldError[],
    readonly details?: Record<string, unknown>,
  ) {
    super(message, status);
  }
}
