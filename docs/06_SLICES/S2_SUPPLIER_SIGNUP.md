# S2 Supplier Sign-up

Status: implementation in progress under separately accepted tasks; whole-slice acceptance pending.

## Path and sources

A `guest` submits legal information → the standing `legal_committee` accepts and raises it → the `admin` accepts without edits → the platform emails an account setup link → the supplier sets a password and opens their profile.

Follow [WORKFLOWS](../01_PROBLEM/WORKFLOWS.md#supplier_signup_process), [V1 scope](../03_SCOPE/V1_SCOPE.md#web-app-nextjs), [ERD](../05_ARCHITECTURE/ERD.md#sign-up), [API contract](../05_ARCHITECTURE/API_CONTRACT.md#sign-up-and-account-setup), [capability matrix](../05_ARCHITECTURE/CAPABILITY_MATRIX.md), and [ADR 0005](../05_ARCHITECTURE/ADR/0005_AUTOMATIC_SUPPLIER_ACCOUNT_SETUP.md). They remain authoritative; this slice changes no endpoint or entity.

## In scope

| Area | Contract endpoints | Outcome |
|---|---|---|
| Application | R2, U1 | Required legal fields, registration and tax certificates, submission confirmation; no applicant status page |
| Legal review | U2–U4, including U3d | Pending queue, legal information and private documents, one accept/reject decision |
| Admin acceptance | U5–U7 | Raised queue and read-only details; accept only, no rejection or editing |
| Account setup | Account Setup S1–S3 | Verify without consumption; set password, verify email and establish session; resend expired links |
| Supplier profile | P1–P3 | Own profile; edit legal and technical information; replace sign-up certificates. Technical documents are postponed after V1 |
| Supplier administration | P4–P5 | Admin directory, suspension and reactivation; suspension blocks new bids only |

Endpoint IDs S1–S3 above belong to the contract's Account Setup group, not the roadmap slice numbers. Reuse Auth A0–A5 for every new role.

Required models: `SUPPLIER_APPLICATION`, `SIGNUP_REVIEW`, `SUPPLIER`, `APPLICATION_DOCUMENT`, `SUPPLIER_DOCUMENT`, `ACCOUNT_SETUP_TOKEN`, `EMAIL_MESSAGE`, and `IDEMPOTENCY_KEY`; reuse accounts, roles, sessions, documents and audit. Apply only the accepted ERD columns, constraints and indexes. Queue infrastructure adds no new domain entity.

## Screens

Proposed web routes below are localized under `/[locale]/`; all text supports English/Arabic and logical RTL layout.

| Group | Route | Behavior |
|---|---|---|
| `(public)` | `/supplier-application` | R2-driven form, file language, validation, confirmation; preserve input on failure |
| `(auth)` | `/account-setup#token=…` | Masked email, language from verify, password form, expired/used/invalid link states |
| `(staff)` | `/signup-reviews`, `/signup-reviews/[applicationId]` | Standing legal role only; documents and accept/reject |
| `(staff)` | `/signup-requests`, `/signup-requests/[applicationId]` | Admin only; reviewed details and accept |
| `(auth)` | `/profile` | Account view for signed-in users; suppliers also edit their legal/technical information and replace sign-up certificates; technical documents postponed after V1 |
| `(auth)` | `/my-assignments` | Signed-in account-ready placeholder; tender assignment screens belong to S3 |
| `(staff)` | `/admin/suppliers` | Admin search/status filter and suspend/reactivate actions |

Extend page-level guards, role start pages and navigation without granting tender access to the standing legal role. The API remains the access authority. See [front-end standards](../04_RULES/ENGINEERING_STANDARDS.md#12-front-end-nextjs).

## Implementation tasks

Each task needs a separate proposal and human acceptance. Branch names follow the [Git workflow](../04_RULES/GIT_WORKFLOW.md#task-branches); this draft does not create or switch branches.

1. **Back end — application and review:** migrate accepted models; R2/U1–U6 (including U3d); guest idempotency with file hashes; private uploads/downloads; legal/admin access and audit.
2. **Back end — setup and delivery:** U7 admin acceptance, hashed expiring tokens, atomic provisioning, setup endpoints and session establishment. Introduce the accepted Redis/BullMQ and Nodemailer/Mailpit services; verify the [email contract check](../07_CONTRACTS/ACCOUNT_SETUP_EMAIL.md) using test files.
3. **Back end — supplier profile/admin:** P1–P5, legal and technical edits with audited legal changes, document ownership and suspension/reactivation. Preserve sign-in for suspended suppliers.
4. **Front end — application/setup:** regenerate the client from Swagger; application and setup screens; keep tokens transient, clear session caches and renew CSRF after completion.
5. **Front end — review/profile/admin:** legal/admin queues, supplier profile, supplier directory, role routing and bilingual errors. Use private user/locale query keys.
6. **Verification:** automated API, database, worker/email and component tests; extend Swagger, the existing Postman collection, README service/run instructions and demo seed accounts.

Provisioning commits admin acceptance, the active supplier profile, pending account, first setup token and automatic email record together. Delivery occurs after commit. Setup activates the account; it is not another legal review. Snapshot email language when preparing the message. Retain uncertain delivery at `sending` under the [ERD email rules](../05_ARCHITECTURE/ERD.md#emails).

## Acceptance checks

- Every application field and required file is validated; extra account/role/password fields are rejected. Same guest key/payload replays the response; changed payload and in-progress retries follow [API §1.3](../05_ARCHITECTURE/API_CONTRACT.md#13-idempotency).
- Legal rejection ends sign-up with no account or rejection email. Acceptance raises exactly one request. Admin cannot edit, reject, bypass legal review or provision twice.
- Invisible applications/documents return 404. Legal reviewers receive no tender access from their standing role.
- Verify does not consume the token. Completion consumes it once, including concurrent requests, verifies email, hashes the password and returns the contract's session and `next` destination.
- Expired, used and invalid links have the contracted outcomes; resend always returns 202. Account setup tokens/passwords never enter logs, request URLs or persisted browser state.
- Profile writes can change the supplier's legal name, registration number, and technical information, never the account email or another supplier's documents. Legal changes are audited with values before and after. Suspension/reactivation follows P5 and preserves sign-in.
- English and Arabic application → email → setup → profile paths pass automated tests; Arabic components use RTL. Message language is fixed at preparation, not at delivery.
- New operations appear in Swagger and the existing Postman collection. Record test results and obtain human acceptance before marking S2 Done.

## Out of scope and open questions

No bids, tender committees/member provisioning, evaluation, award/contact emails, password reset, applicant status page, or rejection email. The shared setup flow must remain reusable by S3 without implementing S3 now.

Settled on November 24, 2026 (see the [API contract](../05_ARCHITECTURE/API_CONTRACT.md#sign-up-and-account-setup) and [engineering standards §2.1](../04_RULES/ENGINEERING_STANDARDS.md#21-authentication)):

1. Setup links expire after 48 hours. A password needs at least 12 characters, with no other complexity rules.
2. A sign-up whose contact email already has an account is refused with `409 EMAIL_ALREADY_REGISTERED`, at submission and again at acceptance. The person signs in instead, and a registered supplier updates their legal information on their profile.
3. A repeated or simultaneous U7 returns `409 ALREADY_ACCEPTED` with `details.supplierId`. A registration number another supplier already has returns `409 REGISTRATION_NUMBER_EXISTS`, and the request stays raised.

## Earlier application/review implementation checkpoint

November 24, 2026: the separately accepted first back-end task implements R2 and U1–U6, including U3d. U7 is excluded until the open questions above are resolved. No front-end sign-up screens, provisioning, setup endpoints, email delivery or profile/admin actions are implemented yet.

- Added the accepted application/review/document models and supporting idempotency table. The accepted `SUPPLIER` table supports existing-registration checks only; no supplier provisioning endpoint is exposed.
- Submission requires both certificates and all legal fields. Idempotency uses a signed server-issued guest scope, canonical payload/file hashes, a 24-hour reservation and an atomic saved response. Replays survive CSRF renewal; pending and changed-payload retries use the contract errors.
- Legal reviewers can read private application documents and decide once. Admin views show accepted/raised requests and their review, without document-download permission. Concurrent decisions leave one review and audit event.
- The approved minimal queue/detail response shapes are recorded in the [API contract](../05_ARCHITECTURE/API_CONTRACT.md#sign-up-and-account-setup). Swagger and the existing Postman collection include the eight new operations; the collection now has 36 requests including signed-file transport.

Verification: 18 new API tests passed. Full regression: **18 back-end unit tests, 82 API/database tests and 105 front-end tests passed**. Cases include scope isolation, reordered JSON replay, changed file hashes, forged scope replacement, private downloads, role denial, rejection without provisioning, concurrent reviews, failure rollback and expired reservation recovery. The migration was applied to the local development database without resetting existing data.

Automated test files only; no browser/Postman runtime verification, lint, production build or separate typecheck was run. Implementation is ready for review, not accepted as the whole S2 slice. No existing-email linking or repeated-U7 response policy was chosen. The legal/admin Postman requests require suitable local accounts; seed updates are still a later task.

## Earlier admin acceptance, account setup and email checkpoint

November 24, 2026: the back end implements U7 and account setup S1–S3, with automatic email delivery through Redis/BullMQ, Nodemailer and Mailpit. Supplier profile actions (P1–P5) and the front-end screens for U7 and setup are not implemented yet.

- U7 commits the admin acceptance, the active supplier, its `pending_setup` account, the first setup link and its `sending` email in one transaction, and queues delivery after commit. Its conflicts follow the settled order above.
- Setup links are stored only as hashes. The email row keeps a placeholder, and the worker puts the link in when it sends. Verify leaves the link usable; complete uses it up once, activates the account, verifies the email and signs the supplier in. Resend always answers `202`, and sends at most 5 links an hour per account.
- Delivery outcomes, recovery and open points are recorded in the [email contract check](../07_CONTRACTS/ACCOUNT_SETUP_EMAIL.md#results).
- The seed adds a fourth demo applicant, accepted by the admin, whose supplier still has to set a password. Swagger, the Postman collection and the README include the new operations.

Verification: `npm run test:e2e` run twice, 13 files and 109 tests passing; 21 back-end unit tests; lint without fixes, Prettier, type check, production build and the schema diff are clean.

## Current web checkpoint — November 24, 2026

This checkpoint supersedes the earlier statements that web screens and U7/setup were pending.

- Guest application: required legal fields and certificates, stable idempotency keys across retries, field errors, existing-email sign-in link and rate-limit handling.
- Legal review: role-specific queue, detail, private downloads and one final accept/reject decision. Admin detail has no document downloads, edits or Reject action.
- Admin U7: regenerated client; Accept with pending/duplicate-click protection. Success shows the setup email's language and `sending` state. `ALREADY_ACCEPTED`, `EMAIL_ALREADY_REGISTERED` and `REGISTRATION_NUMBER_EXISTS` have en/ar messages; success and conflicts refresh the raised queue and detail. The outcome remains visible when the accepted request becomes unavailable.
- Account setup: localized page, fragment-only token read into transient memory, masked email, password form, expired/used/invalid states, resend and rate-limit handling. Completion establishes the session and renews CSRF. Current supplier destination is `/profile`; `/my-assignments` is a placeholder, not an implemented assignment queue. Latest setup work was reported complete and has not been retested.
- Shared UI: role-aware sidebar; account view for every signed-in user; stronger button borders/colors and consistent modest rounding. Employee create/edit/detail use real horizontal tabs, preserve draft inputs and reveal invalid sections when saving.
- Current files also include supplier legal/technical editing, certificate replacement and the admin directory with suspend/reactivate actions. These latest additions have not been reviewed or retested in this checkpoint. Technical-document work remains pending; no whole-slice completion is claimed.

### Verification boundary

Before the latest setup/profile changes, 180 front-end tests in 27 files passed; production build, TypeScript, changed-file lint and formatting passed. Full front-end lint still reported the pre-existing render-time ref access in `SupplierApplicationForm.tsx:30`. The inherited back end passed 21 unit tests and 109 e2e tests twice, plus lint, formatting, typecheck, build and schema comparison.

Further test-file creation and test runs are paused by human direction. No tests were created or run for the latest setup work. Historical passes do not verify the present tree. No browser automation was used. Review the [email follow-up](../07_CONTRACTS/ACCOUNT_SETUP_EMAIL.md#review-follow-up), remaining supplier documents and current implementation before human S2 acceptance. Nothing in this checkpoint authorizes another slice.
