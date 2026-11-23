# Frontend API contract (V1)

Status: accepted (revision 2). Section 4 lists ERD changes that still need separate approval.

For the Next.js teammate building against mocks. Every endpoint shape, header, and error code is a **proposal**, except what the accepted docs already fix: `/api/v1`, the HttpOnly JWT cookie, 404 for records a user may not see, the pagination envelope, and the response DTO names in ENGINEERING_STANDARDS §2.7.

**Decisions applied in this revision**

- The `procurement_officer` uploads and removes Terms of Reference while the tender is `accepted`. The files lock at publication.
- "My bids" shows the tender status only. Each supplier learns their own result from the officer-reviewed email.
- Newly approved committee members activate through the same account setup page, in a language the `admin` chooses. Existing accounts just receive the assignment.

ERD changes this contract depends on are listed in [section 4](#4-erd-changes-pending-approval). Mock against them, but they need separate approval.

## 1. Shared behaviour

### 1.1 Session, CSRF, refresh

- **Cookies.** The API sets two HttpOnly, Secure, `SameSite=Lax` cookies: `access_token` (10 minutes) and `refresh_token`. The web app and the API run on the same site. The frontend never reads either cookie.
- **Credentials.** Every request uses `credentials: 'include'`, set once in the Orval mutator. CORS allows credentials only from the web app's exact origin.
- **CSRF.**
  - `GET /auth/csrf` returns `{ "csrfToken": "…" }`. It works without a session, so guest forms are covered too.
  - The token is bound to the current session, or to the anonymous visitor.
  - Keep it in memory, and send it as `X-CSRF-Token` on every POST, PUT, PATCH, and DELETE.
  - Fetch a new token on app load and after sign-in, sign-out, refresh, account setup, and `SESSION_REVOKED`.
  - On `403 CSRF_TOKEN_INVALID`, fetch a new token and retry once. If it fails again, show a generic error.
- **Refresh.**
  - On `401 SESSION_EXPIRED`, call `POST /auth/refresh`, then retry the original request.
  - Concurrent expired requests share one refresh. The first 401 starts it, and the other requests wait on the same promise.
  - Each refresh replaces the refresh token. If an old refresh token is used again, the server revokes every session in that chain and returns `401 SESSION_REVOKED`.
- **Session ended.** On `401 UNAUTHENTICATED` or `401 SESSION_REVOKED`, clear the cache and go to sign-in with `?returnTo=`.
- **Sign-out.** `POST /auth/sign-out` revokes the session on the server. Every access token for that session stops working at once, because each request checks the session.
- **Server enforcement.** The server enforces every permission and deadline. Detail responses include `allowedActions`, which the UI uses only to show or hide controls. Responses with deadlines include `serverTime`, so countdowns use server time, not the device clock.

### 1.2 Query cache and HTTP caching

- **Query keys.**
  - Public data: `['public', locale, …]`.
  - Private data: `['me', userId, …]`, always including the signed-in user's id.
- **Clearing.** Clear the whole TanStack Query cache on sign-in, sign-out, successful account setup, and `SESSION_REVOKED`. Never persist the cache to browser storage.
- **HTTP caching.**
  - Public tender endpoints (`/tenders…` and `/reference/…`) send `Cache-Control: public, max-age=60` and `Vary: Accept-Language`.
  - Every other response sends `Cache-Control: private, no-store`, including signed download URLs.

### 1.3 Idempotency

- **Which mutations.** Send `Idempotency-Key: <uuid>` on:
  - supplier application
  - bid submission and part replacement
  - translation upload
  - every evaluation submission
  - tie-break award
  - email preparation and sending
- **Retries.** Create the key once per user action, and keep it in the mutation's state, so every retry of that action reuses it.
- **Scope.** The server stores keys per user and per route for 24 hours. A different user using the same key is simply a new request.
- **Replays and misuse.**
  - Same key, same payload (including file hashes): the server returns the original status and body, with `Idempotent-Replayed: true`.
  - Same key, different payload: `422 IDEMPOTENCY_KEY_REUSED`. The UI creates a new key only if the user deliberately changed the form.
  - Same key while the first request is still running: `409 IDEMPOTENCY_IN_PROGRESS`. Wait one second and retry with the same key.

### 1.4 Check order

Every request is checked in this order. The first failure decides the response.

1. Authentication: `401`.
2. Visibility: role, ownership, approved assignment, and stage eligibility. Failure returns `404 NOT_FOUND`, before any status or conflict detail.
3. Tender status: `409 TENDER_STATUS_CHANGED`, with `details.currentStatus`.
4. Revision: `409 VERSION_CONFLICT`, with `details.currentRevision`.
5. Field validation: `400 VALIDATION_FAILED`.
6. Business rules: `422`, for example deadlines and suspension.

### 1.5 Error envelope and codes

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Developer text, not for display",
  "fields": [{ "field": "translations[0].title", "code": "REQUIRED" }],
  "details": {}, "requestId": "req_7f3a" } }
```

The UI translates `code`. It never displays `message`.

| Status | Code | UI behaviour |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Inline errors from `fields[]`, with codes such as `REQUIRED`, `FIELD_NOT_EDITABLE`, `WEIGHTS_MUST_SUM_TO_100`, `DEADLINES_OUT_OF_ORDER`, `DEADLINE_IN_PAST`, `PASSWORD_TOO_WEAK`, `TRANSLATION_SAME_LANGUAGE`. Keep what the user typed. |
| 401 | `INVALID_CREDENTIALS` | Error on the sign-in form. |
| 401 | `SESSION_EXPIRED` | Shared refresh, then retry. |
| 401 | `UNAUTHENTICATED`, `SESSION_REVOKED` | Clear the cache and go to sign-in. |
| 403 | `ACCOUNT_PENDING_SETUP` | "Use the link in your email." |
| 403 | `ACCOUNT_DISABLED` | Blocked notice. |
| 403 | `CSRF_TOKEN_INVALID` | Fetch a new token and retry once. |
| 404 | `NOT_FOUND` | Not-found page, also for records the user may not see. |
| 409 | `TENDER_STATUS_CHANGED` | Refetch and show the new state. Drop the edit. |
| 409 | `VERSION_CONFLICT` | "Changed by someone else." Reload the latest revision and keep the user's unsaved text visible to copy. |
| 409 | `ALREADY_SUBMITTED` | Show `details.evaluation` read-only. |
| 409 | `BID_EXISTS` | Open `details.bidId`. |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | Retry after one second with the same key. |
| 409 | `EMAIL_NOT_EDITABLE`, `TIE_BREAK_NOT_REQUIRED`, `ALREADY_AWARDED`, `TENDER_NOT_CANCELLED`, `TENDER_ALREADY_COPIED`, `ASSIGNMENT_*` | Refetch and show the reason. |
| 410 | `SETUP_LINK_EXPIRED` | Offer "Send a new link". |
| 410 | `SETUP_LINK_USED` | Offer "Sign in". |
| 413, 415 | `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED` | Error on that file input. |
| 422 | `APPLICATION_CLOSED` | The first submission is too late. Replace the bid form with a closed notice. |
| 422 | `BID_PART_LOCKED` | That part's deadline has passed (`details.partType`, `details.deadline`). Lock the part and refetch. |
| 422 | `SUPPLIER_SUSPENDED` | A new bid is blocked. Show a suspended notice. |
| 422 | `IDEMPOTENCY_KEY_REUSED`, `BID_NOT_TIE_CANDIDATE` | Refetch and show an error. |
| 429 | `RATE_LIMITED` | Disable the action until `Retry-After` has passed. |

### 1.6 Formats

- **Collections.** `?page=1&limit=20`, with a maximum of 100. Every collection, including assignments, evaluation queues, ranking, and emails, returns `{ "data": [], "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }`. Filtering happens before counting and paging.
- **Timestamps.** ISO 8601 in UTC, ending in `Z`.
- **Money.** A decimal string plus a currency: `{ "amount": "125000.00", "currency": "USD" }`.
- **Financial evaluation currency.** `tenderCurrency` is the currency of `confirmedTotalPrice`.

### 1.7 Language

- **UI locale.** The locale comes from the route (`/[locale]/…`, `en` or `ar`), and the frontend sends `Accept-Language` from it. For signed-in users, the locale starts from `user.preferredLanguage`.
- **Interface labels** live in the frontend translations. The API returns codes for categories, statuses, outcomes, and document kinds.
- **Tender content.** Responses carry the content language and fallback state:
  ```json
  "content": { "language": "ar", "title": "…", "description": "…" },
  "requestedLanguage": "en", "isFallback": true, "availableLanguages": ["ar"]
  ```
  - Set `lang` and `dir` on the content block from `content.language`, not from the UI locale.
  - When `isFallback` is true, show a notice from the frontend translations.
  - Public content responses also send `Content-Language`.
- **Documents.**
  - `language` is any ISO 639-1 code, so a French original (`fr`) is valid. Show the language name with `Intl.DisplayNames`.
  - An original lists `translations[]`. A translation has `translationOf`.
- **Emails.** Each email carries its own `language`. The preview uses that email's `lang` and `dir`, whatever the officer's UI language.

### 1.8 Files

- **Uploads.** `multipart/form-data`; don't set `Content-Type` yourself. Allowed types are PDF, DOCX, XLSX, PNG, and JPG, at most 20 MB each, with one original per document kind.
- **Downloads.**
  - Each download endpoint returns `{ "url": "…", "expiresAt": "…" }`. The URL is a short-lived signed URL. Open it immediately and never cache it.
  - The URL path holds only a random storage key. The downloaded file name is set by the server: original names for the legal committee, the supplier, and staff; neutral names for blind reviewers.
- **Forms.** Required document kinds and fields come from the form-spec endpoints, so the frontend never hard-codes them.

## 2. Endpoint inventory

Each group below is one Swagger tag, and the README and Postman folder use the same name. "Who and when" is enforced by the server.

| # | Screen / action | Who, when | Endpoint |
|---|---|---|---|
| **Auth** | | | |
| A0 | CSRF token | Anyone | `GET /auth/csrf` |
| A1 | Sign in | An `active` account | `POST /auth/sign-in` |
| A2 | Current session | Signed in | `GET /auth/session` |
| A3 | Refresh | After `SESSION_EXPIRED` | `POST /auth/refresh` |
| A4 | Sign out | Signed in | `POST /auth/sign-out` |
| A5 | Change interface language | Signed in | `PATCH /me` |
| **Reference** | | | |
| R1 | Categories | Anyone | `GET /reference/tender-categories` |
| R2 | Sign-up form spec | Anyone | `GET /reference/forms/supplier-application` |
| **Public Tenders** | | | |
| T1 | Tender list | Anyone. `published` only | `GET /tenders` |
| T2 | Tender detail (`PublicTender`) | Anyone. `published` only; otherwise 404 | `GET /tenders/:tenderId` |
| T2d | Terms of Reference download | Same as T2 | `GET /tenders/:tenderId/documents/:docId/download` |
| **Requester Tenders** | | | |
| Q1 | Create a draft tender | `requester` | `POST /requester/tenders` |
| Q2 | My tenders | `requester`, their own only | `GET /requester/tenders` |
| Q3 | Tender detail (`RequesterTender`) | `requester`, their own only | `GET /requester/tenders/:tenderId` |
| Q4 | Edit draft | `requester`, own, while `draft` | `PATCH /requester/tenders/:tenderId` |
| Q5 | Document download | `requester`, own | `GET /requester/tenders/:tenderId/documents/:docId/download` |
| **Tender Management** | | | |
| M1 | Tender list | `procurement_officer` | `GET /manage/tenders?status=` |
| M2 | Tender detail (`ManagedTender`) | `procurement_officer` | `GET /manage/tenders/:tenderId` |
| M3 | Accept a draft and set scoring | `procurement_officer`, while `draft` | `POST /manage/tenders/:tenderId/accept` |
| M4 | Edit details and scoring | `procurement_officer`, while `accepted` | `PATCH /manage/tenders/:tenderId` |
| M5 | Upload Terms of Reference | `procurement_officer`, while `accepted` | `POST /manage/tenders/:tenderId/documents` |
| M6 | Remove Terms of Reference | `procurement_officer`, while `accepted` | `DELETE /manage/tenders/:tenderId/documents/:docId` |
| M7 | Document download | `procurement_officer` | `GET /manage/tenders/:tenderId/documents/:docId/download` |
| M8 | Publish | `procurement_officer`, while `accepted` | `POST /manage/tenders/:tenderId/publish` |
| M9 | Copy a cancelled tender | `procurement_officer`, while `cancelled` and not yet copied | `POST /manage/tenders/:tenderId/copy` |
| **Sign-up** | | | |
| U1 | Submit a sign-up application | `guest` | `POST /supplier-applications` |
| U2 | Review queue | Standing `legal_committee` role | `GET /signup-reviews?status=pending` |
| U3 | Application detail | Standing `legal_committee` role | `GET /supplier-applications/:applicationId` |
| U3d | Application document download | Standing `legal_committee` role | `GET /supplier-applications/:applicationId/documents/:docId/download` |
| U4 | Accept or reject | Standing `legal_committee` role, once | `POST /supplier-applications/:applicationId/review` |
| U5 | Raised requests | `admin` | `GET /signup-requests?status=raised` |
| U6 | Request detail | `admin` | `GET /signup-requests/:applicationId` |
| U7 | Accept a request | `admin`, while raised | `POST /signup-requests/:applicationId/accept` |
| **Account Setup** | | | |
| S1 | Check a link (does not use it up) | The link holder | `POST /account-setup/verify` |
| S2 | Set a password (uses the link up) | The link holder | `POST /account-setup/complete` |
| S3 | Request a new link | The holder of an expired link | `POST /account-setup/resend` |
| **Suppliers** | | | |
| P1 | My profile | `supplier` | `GET /me/supplier-profile` |
| P2 | Edit technical information | `supplier` | `PUT /me/supplier-profile` |
| P3 | Add or remove a technical document | `supplier` | `POST /me/supplier-profile/documents`, `DELETE /me/supplier-profile/documents/:docId` |
| P4 | Supplier directory | `admin` | `GET /admin/suppliers?status=&search=` |
| P5 | Suspend or reactivate | `admin` | `POST /admin/suppliers/:supplierId/suspend`, `POST /admin/suppliers/:supplierId/reactivate` |
| P6 | Find a supplier to contact | `procurement_officer` | `GET /manage/suppliers?search=` |
| P7 | Supplier detail | `procurement_officer` | `GET /manage/suppliers/:supplierId` |
| **Committees** | | | |
| C1 | A tender's committees and nominations | `procurement_officer` | `GET /manage/tenders/:tenderId/committees` |
| C2 | Raise a committee | `procurement_officer`; tender `accepted`, `published` or `closed` | `POST /manage/tenders/:tenderId/committees` |
| C3 | Nominate a member | Same as C2; the committee is raised | `POST /manage/tenders/:tenderId/committees/:type/nominations` |
| C4 | Withdraw a nomination | `procurement_officer`, while `nominated` | `DELETE /manage/nominations/:nominationId` |
| C5 | Nomination queue | `admin` | `GET /admin/committee-nominations?status=nominated` |
| C6 | Approve or reject a nomination | `admin`; tender not yet `under_evaluation` | `POST /admin/committee-nominations/:nominationId/approve`, `POST /admin/committee-nominations/:nominationId/reject` |
| C7 | My assignments | Any signed-in user | `GET /me/assignments` |
| **Bids** | | | |
| B1 | Bid form spec and eligibility | `supplier` | `GET /tenders/:tenderId/bid-form` |
| B2 | Submit a bid (all three parts) | `active` supplier; `published` tender; before the application deadline | `POST /tenders/:tenderId/bids` |
| B3 | My bids | `supplier`, own | `GET /me/bids` |
| B3d | Bid detail (`SupplierBid`) | `supplier`, own | `GET /me/bids/:bidId` |
| B4 | Replace a bid part | `supplier`, own; before that part's deadline; allowed while suspended | `PUT /me/bids/:bidId/parts/:partType` |
| B5 | Add, replace or remove a translation | Same as B4 | `PUT /me/bids/:bidId/parts/:partType/documents/:docId/translations/:language`, `DELETE` on the same path |
| B6 | Bid document download | `supplier`, own | `GET /me/bids/:bidId/documents/:docId/download` |
| **Legal Evaluation** | | | |
| L1 | Queue | Approved `legal_committee` assignment on this tender | `GET /evaluations/legal/tenders/:tenderId/bids` |
| L2 | Detail (`LegalBidView`) | Same as L1 | `GET /evaluations/legal/tenders/:tenderId/bids/:bidId` |
| L3 | Submit | Same as L1, while `under_evaluation` | `POST /evaluations/legal/tenders/:tenderId/bids/:bidId/evaluation` |
| L4 | Download | Same as L1 | `GET /evaluations/legal/tenders/:tenderId/bids/:bidId/documents/:docId/download` |
| **Technical Evaluation** | | | |
| X1 | Queue | Approved `technical_committee` assignment; bids that passed Legal Evaluation only | `GET /evaluations/technical/tenders/:tenderId/bids` |
| X2 | Detail (`TechnicalBidView`) | Same as X1 | `GET /evaluations/technical/tenders/:tenderId/bids/:bidderCode` |
| X3 | Submit | Same as X1, while `under_evaluation` | `POST /evaluations/technical/tenders/:tenderId/bids/:bidderCode/evaluation` |
| X4 | Download | Same as X1 | `GET /evaluations/technical/tenders/:tenderId/bids/:bidderCode/documents/:docId/download` |
| **Financial Evaluation** | | | |
| F1 | Queue | Approved `financial_committee` assignment; bids that met the minimum technical score only | `GET /evaluations/financial/tenders/:tenderId/bids` |
| F2 | Detail (`FinancialBidView`) | Same as F1 | `GET /evaluations/financial/tenders/:tenderId/bids/:bidderCode` |
| F3 | Submit | Same as F1, while `under_evaluation` | `POST /evaluations/financial/tenders/:tenderId/bids/:bidderCode/evaluation` |
| F4 | Download | Same as F1 | `GET /evaluations/financial/tenders/:tenderId/bids/:bidderCode/documents/:docId/download` |
| **Award** | | | |
| W1 | Award state | `procurement_officer`; tender `published` or later | `GET /manage/tenders/:tenderId/award-status` |
| W2 | Ranking (`BidRankingView`) | `procurement_officer` | `GET /manage/tenders/:tenderId/ranking` |
| W3 | Break a tie at the top | `procurement_officer`, while `tie_break_required` | `POST /manage/tenders/:tenderId/award` |
| **Emails** | | | |
| E1 | A tender's emails | `procurement_officer` | `GET /manage/tenders/:tenderId/emails?kind=award\|cancellation\|contact_supplier` |
| E2 | Email detail and preview | `procurement_officer` | `GET /manage/emails/:emailId` |
| E3 | Edit | `procurement_officer`, while `draft` or `failed` | `PATCH /manage/emails/:emailId` |
| E4 | Send or retry one | `procurement_officer`, while `draft` or `failed` | `POST /manage/emails/:emailId/send` |
| E5 | Send all reviewed | `procurement_officer` | `POST /manage/tenders/:tenderId/emails/send` |
| E6 | Prepare a Contact Supplier email | `procurement_officer`, any tender status | `POST /manage/suppliers/:supplierId/contact-drafts` |

## 3. Payload examples

All examples use one data set. Tender `t-1001` has deadlines on 2026-12-10, 12-17, and 12-24 at 12:00Z. The suppliers are `s-12` (Al-Noor Engineering, bidder code B), `s-14` (Sahel Builders, bidder code D), and `s-15` (Rawda Contracting, bidder code A).

### Auth

`GET /auth/csrf` returns `200 { "csrfToken": "c1f…" }`.

`POST /auth/sign-in` with `{ "email": "rana@akf.org", "password": "••••••••" }` sets the cookies and returns `200`:

```json
{ "user": { "id": "u-77", "email": "rana@akf.org", "preferredLanguage": "en",
    "roles": ["legal_committee"] },
  "supplier": null,
  "serverTime": "2026-11-23T09:00:00Z" }
```

- `roles` are account roles only: `supplier`, `requester`, `procurement_officer`, `admin`, and the standing `legal_committee` role.
- Tender assignments always come from `GET /me/assignments`. A standing legal reviewer can also hold tender assignments.
- After sign-in: clear the cache, fetch a new CSRF token, then load `/me/assignments`.

`GET /auth/session` returns the same body, or `401`.

`POST /auth/refresh` returns `204` and new cookies, or `401 SESSION_REVOKED`.

`POST /auth/sign-out` returns `204`. Clear the cache and fetch a new CSRF token.

`PATCH /me` with `{ "preferredLanguage": "ar" }` returns `200` with the updated `user`. Switch the route locale.

### Public Tenders

`GET /tenders?category=construction&page=1&limit=20`:

```json
{ "data": [{ "id": "t-1001", "status": "published", "categoryCode": "construction",
    "content": { "language": "ar", "title": "صيانة مدرسة الروضة" },
    "requestedLanguage": "en", "isFallback": true,
    "applicationDeadline": "2026-12-10T12:00:00Z" }],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 } }
```

`GET /tenders/t-1001` (`PublicTender`):

```json
{ "id": "t-1001", "status": "published", "categoryCode": "construction",
  "content": { "language": "ar", "title": "صيانة مدرسة الروضة", "description": "…" },
  "requestedLanguage": "en", "isFallback": true, "availableLanguages": ["ar"],
  "deadlines": { "application": "2026-12-10T12:00:00Z", "technical": "2026-12-17T12:00:00Z",
    "financial": "2026-12-24T12:00:00Z" },
  "documents": [{ "id": "d-7", "kind": "terms_of_reference", "name": "ToR.pdf", "language": "ar",
    "translations": [{ "id": "d-8", "name": "ToR (en).pdf", "language": "en" }] }],
  "serverTime": "2026-11-23T09:00:00Z" }
```

- Never included: estimated balance, scoring settings, committees, requester, bid counts.
- Statuses other than `published` return 404 here. A participating supplier reads the tender through `GET /me/bids/:bidId`.
- `GET /tenders/t-1001/documents/d-8/download` returns `{ "url": "…", "expiresAt": "2026-11-23T09:05:00Z" }`.

### Requester Tenders

`POST /requester/tenders`:

```json
{ "categoryCode": "construction",
  "estimatedBalance": { "amount": "125000.00", "currency": "USD" },
  "translations": [{ "language": "en", "title": "School maintenance", "description": "…" }] }
```

- Returns `201 { "id": "t-1001", "status": "draft", "revision": 1 }`.
- Deadline, committee, supplier, and scoring fields return `400` with field code `FIELD_NOT_EDITABLE`.
- Each translation must have both a title and a description.

`GET /requester/tenders/t-1001` (`RequesterTender`):

```json
{ "id": "t-1001", "status": "draft", "revision": 2, "categoryCode": "construction",
  "estimatedBalance": { "amount": "125000.00", "currency": "USD" },
  "translations": [{ "language": "en", "title": "School maintenance", "description": "…" }],
  "deadlines": null, "documents": [], "cancellationReason": null,
  "allowedActions": ["edit"] }
```

- Never included: scoring settings, committees, ranking, award details, bids.
- `PATCH /requester/tenders/t-1001` takes `{ "revision": 2, "translations": [ … ] }` and returns `200 { "revision": 3 }`.
- After the officer accepts the tender, editing returns `409 TENDER_STATUS_CHANGED`.

### Tender Management

A draft and an accepted tender are the same resource, with the same id and one `revision` counter. The current revision comes from `GET /manage/tenders/:tenderId`. These changes increase it:

- the requester's edits
- the officer's edits to content, category, estimated balance, or scoring
- uploading or removing Terms of Reference
- accepting and publishing

Raising committees and nominating members don't change it.

`GET /manage/tenders/t-1001` (`ManagedTender`):

```json
{ "id": "t-1001", "status": "accepted", "revision": 5, "categoryCode": "construction",
  "requester": { "id": "u-20", "name": "Lina H." },
  "estimatedBalance": { "amount": "125000.00", "currency": "USD" },
  "translations": [{ "language": "en", "title": "School maintenance", "description": "…" },
                   { "language": "ar", "title": "صيانة مدرسة الروضة", "description": "…" }],
  "scoring": { "technicalWeight": 70, "financialWeight": 30, "minimumTechnicalScore": 60 },
  "deadlines": null,
  "documents": [{ "id": "d-7", "kind": "terms_of_reference", "name": "ToR.pdf", "language": "ar",
    "translations": [{ "id": "d-8", "name": "ToR (en).pdf", "language": "en" }] }],
  "copiedFromTenderId": null, "copiedIntoTenderId": null, "cancellationReason": null,
  "allowedActions": ["edit", "upload_terms_of_reference", "publish", "raise_committee"] }
```

`POST /manage/tenders/t-1001/accept`:

```json
{ "revision": 3, "technicalWeight": 70, "financialWeight": 30, "minimumTechnicalScore": 60 }
```

Returns `200 { "status": "accepted", "revision": 4 }`. If the requester edited the draft in the meantime, the officer gets `409 VERSION_CONFLICT`.

`POST /manage/tenders/t-1001/documents` uploads Terms of Reference as multipart:

| Field | Value |
|---|---|
| `revision` | `4` |
| `kind` | `terms_of_reference` |
| `file` | `ToR.pdf` |
| `language` | `ar` |
| `translationOf` | optional: the id of the original, when uploading a translated copy |

Returns `201 { "document": { "id": "d-7", … }, "revision": 5 }`.

`DELETE /manage/tenders/t-1001/documents/d-7?revision=5` returns `200 { "revision": 6 }`. Deleting an original also deletes its translations.

`POST /manage/tenders/t-1001/publish`:

```json
{ "revision": 6, "categoryCode": "construction",
  "deadlines": { "application": "2026-12-10T12:00:00Z", "technical": "2026-12-17T12:00:00Z",
    "financial": "2026-12-24T12:00:00Z" } }
```

- Returns `200 { "status": "published", "revision": 7, "publishedAt": "2026-11-23T10:00:00Z" }`.
- From now on, the content, scoring, deadlines, and Terms of Reference are read-only.
- Possible field codes: `DEADLINES_OUT_OF_ORDER`, `DEADLINE_IN_PAST`.

`POST /manage/tenders/t-0990/copy` returns `201 { "id": "t-1002", "status": "accepted", "revision": 1, "copiedFromTenderId": "t-0990" }`. Possible errors: `409 TENDER_NOT_CANCELLED`, `409 TENDER_ALREADY_COPIED` with `details.copyId`.

**`VERSION_CONFLICT` versus `TENDER_STATUS_CHANGED`:**

- The tender is still in the same status, but someone saved a newer revision: `VERSION_CONFLICT`. Reload and retry.
- The status itself changed (accepted, published, or changed automatically at a deadline): `TENDER_STATUS_CHANGED`. The edit no longer applies, so drop it.

### Sign-up and Account Setup

`GET /reference/forms/supplier-application`:

```json
{ "fields": [{ "name": "legalName", "type": "text", "required": true, "maxLength": 200 },
             { "name": "registrationNumber", "type": "text", "required": true },
             { "name": "contactEmail", "type": "email", "required": true },
             { "name": "preferredLanguage", "type": "enum", "values": ["en", "ar"], "required": true }],
  "documents": [{ "kind": "registration_certificate", "required": true },
                { "kind": "tax_certificate", "required": true }] }
```

`POST /supplier-applications` is multipart:

| Field | Value |
|---|---|
| `application` | `{"legalName":"Al-Noor Engineering","registrationNumber":"CR-88231","contactEmail":"info@alnoor.example","preferredLanguage":"ar"}` |
| `files[registration_certificate]` | `commercial-register.pdf` |
| `languages[registration_certificate]` | `ar` |
| `files[tax_certificate]` | `tax.pdf` |
| `languages[tax_certificate]` | `ar` |

- Returns `201 { "applicationId": "a-55", "submittedAt": "2026-11-23T09:10:00Z" }`. Show "Submitted for legal review".
- `409 REGISTRATION_NUMBER_EXISTS` is shown as a field error.
- V1 has no status page and no rejection email for the applicant.

`GET /supplier-applications/a-55` shows the legal reviewer the application fields and documents with their original names. Documents download through `GET /supplier-applications/a-55/documents/:docId/download`.

`POST /supplier-applications/a-55/review` with `{ "decision": "accepted", "reason": null }` returns `201 { "decision": "accepted", "raisedToAdminAt": "2026-11-23T11:00:00Z" }`. Submitting again returns `409 ALREADY_SUBMITTED`, with the saved decision in `details`.

`POST /signup-requests/a-55/accept` (no body) returns `200`:

```json
{ "supplierId": "s-12", "accountStatus": "pending_setup",
  "setupEmail": { "language": "ar", "status": "sending" } }
```

**The setup link.** The email links to `/{lang}/account-setup#token=…`. The token sits in the URL fragment, so it never appears in a request URL or server log.

1. `POST /account-setup/verify` with `{ "token": "…" }` returns `200 { "email": "i***@alnoor.example", "preferredLanguage": "ar", "accountType": "supplier" }`.
   - This only checks the link. The token stays valid.
   - Render the page in `preferredLanguage`.
2. `POST /account-setup/complete` with `{ "token": "…", "password": "…" }` uses up the token.
   - It returns `200`: the session body plus `"next": "supplier_profile"`, or `"my_assignments"` for a committee member.
   - Clear the cache, fetch a new CSRF token, then navigate to `next`.
3. Errors from either call:
   - `410 SETUP_LINK_EXPIRED`: "Send a new link" calls `POST /account-setup/resend` with `{ "token": "…" }`, which always returns `202`.
   - `410 SETUP_LINK_USED`: show "Sign in".
   - `404`: the link is invalid.
   - `400 PASSWORD_TOO_WEAK`: field error.

### Suppliers

`GET /me/supplier-profile`:

```json
{ "id": "s-12", "legalName": "Al-Noor Engineering", "registrationNumber": "CR-88231",
  "status": "active", "technicalInformation": "…",
  "technicalDocuments": [{ "id": "d-40", "kind": "company_profile", "name": "Profile.pdf",
    "language": "fr", "translations": [] }],
  "editableFields": ["technicalInformation"] }
```

- `PUT /me/supplier-profile` with `{ "technicalInformation": "…" }` returns `200`. Any other field returns `400 FIELD_NOT_EDITABLE`.
- `POST /me/supplier-profile/documents` is multipart (`kind`, `file`, `language`, optional `translationOf`). Only technical kinds are accepted.

`GET /admin/suppliers?status=active&search=noor` returns a paginated list of `{ id, legalName, registrationNumber, status, allowedActions: ["suspend"] }`. `POST /admin/suppliers/s-12/suspend` returns `200 { "status": "suspended" }`. Repeating it returns the same result.

`GET /manage/suppliers?search=noor` returns a paginated list of `{ id, legalName, registrationNumber, status }`.

`GET /manage/suppliers/s-12` returns:

```json
{ "id": "s-12", "legalName": "Al-Noor Engineering", "registrationNumber": "CR-88231",
  "status": "active", "preferredLanguage": "ar", "email": "i***@alnoor.example",
  "allowedActions": ["contact"] }
```

Neither supplier endpoint returns bids, tender participation, or evaluations.

### Committees

`POST /manage/tenders/t-1001/committees` with `{ "type": "technical_committee" }` returns `201 { "type": "technical_committee", "raisedAt": "…" }`. Repeating it returns `200` with the same body.

`POST /manage/tenders/t-1001/committees/technical_committee/nominations` with `{ "nomineeName": "Omar F.", "nomineeEmail": "omar@akf.org" }` returns `201 { "id": "n-9", "status": "nominated", "hasAccount": false }`.

`GET /manage/tenders/t-1001/committees`:

```json
{ "data": [{ "type": "technical_committee", "raisedAt": "…",
    "nominations": [{ "id": "n-9", "nomineeName": "Omar F.", "status": "nominated" }] }],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 } }
```

`GET /admin/committee-nominations?status=nominated` returns a paginated list of `{ id, tenderId, tenderContent, committeeType, nomineeName, nomineeEmail, hasAccount }`.

`POST /admin/committee-nominations/n-9/approve`:

- With no account yet, the body `{ "preferredLanguage": "en" }` is required. The response is `200 { "status": "approved", "accountCreated": true, "setupEmail": { "language": "en", "status": "sending" } }`.
- With an existing account, the body is ignored and no email is sent: `200 { "status": "approved", "accountCreated": false }`.
- Rule violations return `409`:
  - `ASSIGNMENT_ONE_COMMITTEE_PER_TENDER`
  - `ASSIGNMENT_REQUESTER_CONFLICT`
  - `ASSIGNMENT_STAFF_CONFLICT`
- If the tender is already `under_evaluation`, approval returns `409 TENDER_STATUS_CHANGED`.

`GET /me/assignments`. Counts include only bids this assignment may see:

```json
{ "data": [{ "assignmentId": "n-9", "tenderId": "t-1001",
    "tenderContent": { "language": "en", "title": "School maintenance" },
    "committeeType": "technical_committee", "stage": "open", "pendingCount": 2 }],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 } }
```

`stage` is one of:

- `waiting`: the tender is not yet `under_evaluation`, or no bid has reached this stage
- `open`: there are bids to evaluate
- `read_only`: the tender is `awarded` or `cancelled`

### Bids

**Deadlines**, all strictly before the deadline, by server time:

| Action | Cutoff |
|---|---|
| First submission (all three parts) | Application deadline. The tender must also be `published`. |
| Replace legal information | Application deadline |
| Replace technical offer | Technical deadline |
| Replace financial offer | Financial deadline |

`GET /tenders/t-1001/bid-form` (B1):

```json
{ "canSubmit": true, "reasonCode": null, "existingBid": null,
  "deadlines": { "application": "2026-12-10T12:00:00Z", "technical": "2026-12-17T12:00:00Z",
    "financial": "2026-12-24T12:00:00Z" },
  "parts": [
    { "partType": "legal_information",
      "fields": [{ "name": "authorizedSignatoryName", "type": "text", "required": true, "maxLength": 120 }],
      "documents": [{ "kind": "registration_certificate", "required": true }] },
    { "partType": "technical_offer", "fields": [],
      "documents": [{ "kind": "technical_proposal", "required": true }] },
    { "partType": "financial_offer", "fields": [],
      "documents": [{ "kind": "financial_proposal", "required": true }] }],
  "serverTime": "2026-11-23T09:00:00Z" }
```

When `canSubmit` is false, `reasonCode` is one of:

- `SUPPLIER_SUSPENDED`
- `APPLICATION_CLOSED`
- `BID_EXISTS`: `existingBid` is then `{ "bidId": "bid-3", "allowedActions": ["replace_technical_offer", "replace_financial_offer"] }`

`POST /tenders/t-1001/bids` (B2) is multipart, with `Idempotency-Key`:

| Field | Value |
|---|---|
| `bid` | `{"legalInformation":{"authorizedSignatoryName":"Hiba Saleh"}}` |
| `files[legal_information][registration_certificate]` | `commercial-register.pdf` |
| `languages[legal_information][registration_certificate]` | `ar` |
| `translations[legal_information][registration_certificate]` | `commercial-register-en.pdf` (optional) |
| `translationLanguages[legal_information][registration_certificate]` | `en` (required with a translation) |
| `files[technical_offer][technical_proposal]` | `proposal.pdf` |
| `languages[technical_offer][technical_proposal]` | `fr` |
| `files[financial_offer][financial_proposal]` | `price-schedule.xlsx` |
| `languages[financial_offer][financial_proposal]` | `en` |

At submission, each original can carry at most one translation. Add more later with B5. The form tells suppliers not to identify themselves in technical or financial files.

Returns `201` (`SupplierBid`, the same shape as B3d):

```json
{ "id": "bid-3",
  "tender": { "id": "t-1001", "status": "published",
    "content": { "language": "ar", "title": "صيانة مدرسة الروضة" } },
  "legalInformation": { "authorizedSignatoryName": "Hiba Saleh" },
  "parts": [
    { "partType": "legal_information", "deadline": "2026-12-10T12:00:00Z", "locked": false,
      "lastSubmittedAt": "2026-11-23T09:20:00Z",
      "documents": [{ "id": "d-30", "kind": "registration_certificate", "name": "commercial-register.pdf",
        "language": "ar", "translations": [{ "id": "d-33", "name": "commercial-register-en.pdf", "language": "en" }] }],
      "allowedActions": ["replace", "manage_translations"] },
    { "partType": "technical_offer", "deadline": "2026-12-17T12:00:00Z", "locked": false,
      "lastSubmittedAt": "2026-11-23T09:20:00Z",
      "documents": [{ "id": "d-31", "kind": "technical_proposal", "name": "proposal.pdf",
        "language": "fr", "translations": [] }],
      "allowedActions": ["replace", "manage_translations"] },
    { "partType": "financial_offer", "deadline": "2026-12-24T12:00:00Z", "locked": false,
      "lastSubmittedAt": "2026-11-23T09:20:00Z",
      "documents": [{ "id": "d-32", "kind": "financial_proposal", "name": "price-schedule.xlsx",
        "language": "en", "translations": [] }],
      "allowedActions": ["replace", "manage_translations"] }],
  "serverTime": "2026-11-23T09:20:00Z" }
```

- Never included: bidder code, evaluations, scores, ranking, other bids.
- Errors, in check order:
  - `404`: the tender isn't visible to this supplier.
  - `400 VALIDATION_FAILED`: `fields` names each missing field or file. Nothing is saved.
  - `409 BID_EXISTS`: `details` carries `bidId` and `allowedActions`.
  - `422 SUPPLIER_SUSPENDED`.
  - `422 APPLICATION_CLOSED`: the deadline passed, or the tender is no longer `published`.

`GET /me/bids` returns a paginated list:

```json
{ "data": [{ "bidId": "bid-3",
    "tender": { "id": "t-1001", "status": "under_evaluation",
      "content": { "language": "ar", "title": "صيانة مدرسة الروضة" } },
    "nextDeadline": null, "lockedParts": ["legal_information", "technical_offer", "financial_offer"] }],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 } }
```

The list shows the tender status only, never "won" or "not won".

**B4: replace a part.** `PUT /me/bids/bid-3/parts/technical_offer` is multipart, with `Idempotency-Key`:

| Field | Value |
|---|---|
| `files[technical_proposal]` | `proposal-v2.pdf` (every required kind, in full) |
| `languages[technical_proposal]` | `en` |
| `translations[technical_proposal]` | optional |
| `translationLanguages[technical_proposal]` | required with a translation |

- For `legal_information`, also send a `legalInformation` JSON field.
- Returns `200` with that part, as shown in B2.
- The replacement is all-or-nothing. Every previous original and translation in the part is deleted, including any translation not re-sent.
- A failed replacement changes nothing: on a validation error, a deadline error, or a lost connection with no replay, the previous part stays exactly as it was.
- After the deadline: `422 BID_PART_LOCKED`.
- Allowed while the supplier is suspended.

**B5: one translation.** `PUT /me/bids/bid-3/parts/technical_offer/documents/d-31/translations/en` is multipart with a `file` field.

- Returns `200 { "id": "d-35", "translationOf": "d-31", "language": "en", "name": "proposal-en.pdf" }`.
- An existing translation in the same language is replaced.
- `DELETE` on the same path returns `204`.
- `docId` must be an original. A language equal to the original's returns `400 TRANSLATION_SAME_LANGUAGE`.
- The cutoff is the same as for B4.

### Evaluation (separate DTOs; absent fields are never sent)

All three committees follow the same rules:

- **Who sees what.** One rule drives queue lists, `meta.total`, `/me/assignments` counts, detail, submission, and downloads (originals and translations): an approved assignment of that committee type on that tender, plus eligibility for that stage.
  - Legal: every bid of the tender.
  - Technical: bids that passed Legal Evaluation.
  - Financial: bids that met the minimum technical score.
- **Anything else returns 404.** That includes a bidder code from another stage.
- **Status.** Queues need the tender to be `under_evaluation`, `awarded`, or `cancelled`. Before that, a queue returns `409 TENDER_STATUS_CHANGED`. Submission needs `under_evaluation`; afterwards everything is read-only.
- **Repeat submission.** `409 ALREADY_SUBMITTED`, with the saved evaluation in `details.evaluation`. Show it read-only.

**Legal** (`LegalBidView`): supplier identity is allowed; original file names are used.

```json
{ "bidId": "bid-3",
  "supplier": { "id": "s-12", "legalName": "Al-Noor Engineering", "registrationNumber": "CR-88231" },
  "legalInformation": { "authorizedSignatoryName": "Hiba Saleh" },
  "documents": [{ "id": "d-30", "kind": "registration_certificate", "name": "commercial-register.pdf",
    "language": "ar", "translations": [{ "id": "d-33", "name": "commercial-register-en.pdf", "language": "en" }] }],
  "evaluation": null, "allowedActions": ["submit"] }
```

- Never included: the technical and financial offers, other committees' evaluations, scoring settings, estimated balance.
- Submit with `POST /evaluations/legal/tenders/t-1001/bids/bid-3/evaluation` and `{ "outcome": "pass", "reason": null }`. It returns `201`.

**Technical** (`TechnicalBidView`). The queue is `GET /evaluations/technical/tenders/t-1001/bids?page=1`:

```json
{ "data": [{ "bidderCode": "B", "evaluated": false }, { "bidderCode": "D", "evaluated": true }],
  "meta": { "page": 1, "limit": 20, "total": 2, "totalPages": 1 } }
```

`GET /evaluations/technical/tenders/t-1001/bids/B`:

```json
{ "bidderCode": "B",
  "documents": [{ "id": "d-31", "kind": "technical_proposal", "name": "Technical offer – B – 1.pdf",
    "language": "fr", "translations": [{ "id": "d-35", "name": "Technical offer – B – 1 (en).pdf", "language": "en" }] }],
  "evaluation": null, "allowedActions": ["submit"] }
```

- Never included: bid id, supplier identity, original file names, uploader, legal information, the financial offer, price, financial score, score weights, minimum score, `meetsMinimum`, estimated balance, ranking.
- Submit with `POST …/technical/tenders/t-1001/bids/B/evaluation` and `{ "technicalScore": 78, "comments": "…" }`, a whole number from 0 to 100. It returns `201 { "technicalScore": 78, "submittedAt": "…" }`.
- `GET …/bids/B/documents/d-35/download` returns a URL whose download is named `Technical offer – B – 1 (en).pdf`.

**Financial** (`FinancialBidView`):

```json
{ "bidderCode": "B", "tenderCurrency": "USD",
  "documents": [{ "id": "d-32", "kind": "financial_proposal", "name": "Financial offer – B – 1.xlsx",
    "language": "en", "translations": [] }],
  "evaluation": null, "allowedActions": ["submit"] }
```

- Never included: bid id, supplier identity, original file names, uploader, legal information, the technical offer, technical score, score weights, minimum score, estimated balance, ranking.
- Submit with `{ "financialScore": 85, "confirmedTotalPrice": "118500.00", "comments": "…" }`. The price is a decimal string in `tenderCurrency`.

The frontend renders "Bidder B" from a translated label.

### Award

`GET /manage/tenders/:tenderId/award-status` always answers, whatever the state of the ranking. `awardStatus` is one of:

| `awardStatus` | Meaning |
|---|---|
| `in_progress` | `published`, `closed`, or `under_evaluation`, with no award yet. Read `tenderStatus` and `progress`. |
| `tie_break_required` | Several bids share the top combined score. |
| `awarded` | The tender has a winner. |
| `cancelled` | No bids, or no qualified bid remained. |

**Unique top score**, awarded automatically by the system:

```json
{ "tenderId": "t-1001", "tenderStatus": "awarded", "awardStatus": "awarded", "cancellationReason": null,
  "progress": { "legal": { "done": 3, "total": 3 }, "technical": { "done": 3, "total": 3 },
    "financial": { "done": 3, "total": 3 } },
  "award": { "bidId": "bid-3", "supplier": { "id": "s-12", "legalName": "Al-Noor Engineering" },
    "selection": "top_rank", "awardedAt": "2026-12-28T10:00:00Z" },
  "tieBreakCandidates": [] }
```

**Tie at the top.** The tender stays `under_evaluation`:

```json
{ "tenderId": "t-1001", "tenderStatus": "under_evaluation", "awardStatus": "tie_break_required",
  "cancellationReason": null,
  "progress": { "legal": { "done": 3, "total": 3 }, "technical": { "done": 3, "total": 3 },
    "financial": { "done": 3, "total": 3 } },
  "award": null,
  "tieBreakCandidates": [
    { "bidId": "bid-3", "supplier": { "id": "s-12", "legalName": "Al-Noor Engineering" },
      "technicalScore": 78, "financialScore": 85, "combinedScore": "80.10" },
    { "bidId": "bid-5", "supplier": { "id": "s-14", "legalName": "Sahel Builders" },
      "technicalScore": 81, "financialScore": 78, "combinedScore": "80.10" }] }
```

Show "Choose winner" only when `awardStatus` is `tie_break_required`, and only for `tieBreakCandidates`.

**No bids.** The tender went straight from `published` to `cancelled`:

```json
{ "tenderId": "t-1003", "tenderStatus": "cancelled", "awardStatus": "cancelled",
  "cancellationReason": "no_bids",
  "progress": { "legal": { "done": 0, "total": 0 }, "technical": { "done": 0, "total": 0 },
    "financial": { "done": 0, "total": 0 } },
  "award": null, "tieBreakCandidates": [] }
```

- For this tender, `GET /manage/tenders/t-1003/ranking` returns `{ "data": [], "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }`.
- `GET /manage/tenders/t-1003/emails?kind=cancellation` returns the same empty page: there are no recipients.

**Ranking.** `GET /manage/tenders/t-1001/ranking?page=1` (`BidRankingView`) is paginated and sorted by rank. Ties share a rank:

```json
{ "data": [
    { "bidId": "bid-3", "rank": 1, "supplier": { "id": "s-12", "legalName": "Al-Noor Engineering" },
      "technicalScore": 78, "financialScore": 85, "combinedScore": "80.10", "aboveEstimatedBalance": false },
    { "bidId": "bid-5", "rank": 1, "supplier": { "id": "s-14", "legalName": "Sahel Builders" },
      "technicalScore": 81, "financialScore": 78, "combinedScore": "80.10", "aboveEstimatedBalance": true },
    { "bidId": "bid-8", "rank": 3, "supplier": { "id": "s-15", "legalName": "Rawda Contracting" },
      "technicalScore": 70, "financialScore": 84, "combinedScore": "74.20", "aboveEstimatedBalance": false }],
  "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 } }
```

- Never included: bid parts, documents, confirmed price, bidder codes.
- Before the ranking exists, `data` is empty. Read the state from `award-status`.

**Tie-break.** `POST /manage/tenders/t-1001/award` with `{ "bidId": "bid-5" }` and `Idempotency-Key` returns:

```json
{ "tenderStatus": "awarded", "award": { "bidId": "bid-5", "selection": "tie_break", "awardedAt": "…" } }
```

- Possible errors: `409 TIE_BREAK_NOT_REQUIRED`, `409 ALREADY_AWARDED`, `422 BID_NOT_TIE_CANDIDATE`.
- After success, refetch `award-status` and the ranking, then open the award emails.

### Emails

**Statuses:** `draft → sending → sent | failed`, and `failed → sending` on a retry.

- Each email has a `revision`, which every edit increases.
- Sending always names the revision the officer reviewed. The server delivers exactly that revision, or refuses.

`GET /manage/tenders/t-1001/emails?kind=award`. `kind=award` covers both the winner's email and the other bidders':

```json
{ "data": [{ "id": "m-1", "kind": "award_winner", "status": "draft", "revision": 2, "language": "ar",
    "recipient": { "supplierId": "s-12", "legalName": "Al-Noor Engineering", "email": "i***@alnoor.example" },
    "subject": "…", "body": "…", "failure": null, "sentAt": null }],
  "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 } }
```

- **Preview** uses the email's `lang` and `dir` (`ar` means right-to-left). Templates for bidders who did not win contain no scores.
- **Edit.** `PATCH /manage/emails/m-1` with `{ "subject": "…", "body": "…", "revision": 2 }` returns `200 { "revision": 3 }`.
  - An older revision returns `409 VERSION_CONFLICT`.
  - An email that is `sending` or `sent` returns `409 EMAIL_NOT_EDITABLE`.
- **Send one, or retry.** `POST /manage/emails/m-1/send` with `{ "revision": 3 }` and `Idempotency-Key`:
  - From `draft` or `failed`: `202 { "status": "sending", "revision": 3 }`.
  - Already `sending` or `sent`: `200` with the current status. Nothing is delivered twice.
  - A different revision: `409 VERSION_CONFLICT`.
- **Send all reviewed.** `POST /manage/tenders/t-1001/emails/send` with `{ "kind": "award", "revisions": { "m-1": 3, "m-2": 1, "m-3": 1 } }` and `Idempotency-Key` returns `202`:
  ```json
  { "sending": ["m-1", "m-3"],
    "skipped": [{ "id": "m-2", "reason": "revision_changed" }] }
  ```
  - Other skip reasons: `already_sending`, `already_sent`, `not_listed` (an email missing from `revisions`).
  - Send one and Send all both move an email out of `draft` only if it is still `draft`, so an email racing between them is delivered once.
- **Polling.** While any email is `sending`, refetch the list every 3 seconds, for at most 60 seconds. After that, show "Still sending, check again later".
- **Failure.** A failed email shows `failure: { "code": "DELIVERY_FAILED", "at": "…" }` and a Retry button. Retry is the same call as Send one.
- **Contact Supplier.** `POST /manage/suppliers/s-12/contact-drafts` with `{ "tenderId": "t-1001" }` (`tenderId` is optional) and `Idempotency-Key` returns `201`:
  ```json
  { "id": "m-9", "kind": "contact_supplier", "status": "draft", "revision": 1, "language": "ar",
    "subject": "", "body": "" }
  ```
  - The language is the supplier's preferred language when the email is prepared, and it stays fixed.
  - Then edit and send it through E3 and E4.
- **Cancellation emails** (`kind=cancellation`) follow the same flow. No email exists for an applicant whose sign-up was rejected; that is outside the accepted V1 sign-up flow.

## 4. ERD changes pending approval

The contract uses these, but they aren't in the accepted ERD.

1. **Email statuses.** `EMAIL_MESSAGE.status` gains `sending`, and `EMAIL_MESSAGE` gains `revision`.
2. **Tender revision.** `TENDER` gains `revision`, the counter behind `VERSION_CONFLICT`.
3. **Supporting tables, not drawn** (like `AUDIT_EVENT):
   - `SESSION`: refresh-token rotation, replay detection, sign-out revocation.
   - `IDEMPOTENCY_KEY`: user, route, key, payload hash, stored response, expiry.
4. **Committee member accounts.** Approving a nomination for someone without an account creates a `pending_setup` account in the language the `admin` chose. It reuses `ACCOUNT_SETUP_TOKEN` and the `account_setup` email kind. Once approved, the ERD and WORKFLOWS must describe this.

## 5. Out of scope for V1

- Rejection email to an applicant
- Password reset
- Manual cancellation
- Supplier ratings
- Contracts and delivery
- A won/not-won display in the app
