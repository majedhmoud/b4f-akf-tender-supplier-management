# S1 Tender Publishing

Status: accepted specification. Implementation is ready for human review; slice acceptance is pending.

The first V1 slice and the spec for its code reviews. It links to the accepted rules instead of restating them ([standards §6.6](../04_RULES/ENGINEERING_STANDARDS.md#66-documentation)). Terms follow the [glossary](../GLOSSARY.md).

## Path

An `employee` creates a **draft tender** → the `procurement_officer` accepts it with scoring, attaches the Terms of Reference, sets the **supplier bid form**, and publishes it → a `guest` finds it in English or Arabic.

This is [use case UC1](../05_ARCHITECTURE/USE_CASES.md#uc1-publish-a-tender-s1) and the first row of the [V1 scope](../03_SCOPE/V1_SCOPE.md#web-app-nextjs).

## In scope

### Endpoints

From the [API contract endpoint inventory](../05_ARCHITECTURE/API_CONTRACT.md#2-endpoint-inventory). Shapes, rules, and error codes are in the contract.

| Group | Endpoints | Notes for S1 |
|---|---|---|
| Auth | A0–A5 | Staff sign-in only. Accounts come from the seed; there is no sign-up in S1. |
| Reference | R1 | Categories, from the seeded list ([ERD A7](../05_ARCHITECTURE/ERD.md#assumptions)). |
| Public Tenders | T1, T2, T2d | Only `published` tenders. |
| Employee Tenders | Q1–Q5 | The employee's own tenders only. |
| Tender Management | M1–M11 | Includes Terms of Reference, the supplier bid form, publishing, and copying a cancelled tender. |

### Tables

From the [ERD](../05_ARCHITECTURE/ERD.md). One migration per back-end step.

- Accounts: `USER_ACCOUNT`, `USER_ROLE`, `SESSION`, `SESSION_REFRESH_TOKEN`.
- Tenders: `TENDER_CATEGORY`, `TENDER`, `TENDER_TRANSLATION`, `TENDER_SCORING`.
- Files: `DOCUMENT`, `TENDER_DOCUMENT`.
- Supplier bid form: `TENDER_FORM_FIELD`, `TENDER_FORM_FIELD_TRANSLATION`.
- Audit: `AUDIT_EVENT`.

### Screens

Under `/[locale]/`, in English and Arabic, with the route groups in [standards §12](../04_RULES/ENGINEERING_STANDARDS.md#12-front-end-nextjs).

| Group | Screen | Endpoints |
|---|---|---|
| `(public)` | Tender list, with category filter and pagination | R1, T1 |
| `(public)` | Tender detail, with deadline countdowns and Terms of Reference download | T2, T2d |
| `(auth)` | Staff sign-in and sign-out | A0–A4 |
| `(staff)` | Employee: my tenders, new draft, draft detail and edit | Q1–Q5 |
| `(staff)` | Officer: tender list by status | M1 |
| `(staff)` | Officer: tender detail with accept and scoring, edit, Terms of Reference, publish with deadlines, copy | M2–M9 |
| `(staff)` | Officer: supplier bid form editor | M10, M11 |

### Audit events

From [standards §8](../04_RULES/ENGINEERING_STANDARDS.md#8-audit-logging): draft tender created, draft tender accepted, tender published. Also unauthorized access attempts.

### Seed data

[Standards](../04_RULES/CODING_STANDARDS.md#26-seed-data) and the [submission requirements](../01_PROBLEM/SUBMISSION_REQUIREMENTS.md#environment-and-demo-accounts) apply.

- The fixed category list.
- Demo accounts: one `employee`, one `procurement_officer`, each with a demo password listed in the README.
- Tenders: one `draft`, one `accepted`, one `published` with an English and an Arabic translation, one `published` in Arabic only (to show fallback), and one `cancelled` (to show copying).

## Out of scope

- Committees (raising them is S3). M2 may list `raise_committee` in `allowedActions`; the S1 screens hide it.
- Status changes at deadlines (`closed`, `cancelled`, `under_evaluation`). They need the background jobs that arrive with S4.
- Bids, supplier sign-up, and supplier screens.
- Idempotency keys: no S1 action is in the list in [API contract §1.3](../05_ARCHITECTURE/API_CONTRACT.md#13-idempotency).
- Redis, BullMQ, and email.

## Tasks

Each task is one branch ([GIT_WORKFLOW.md](../04_RULES/GIT_WORKFLOW.md#task-branches)). The front-end tasks start once the back-end endpoints they use are merged into `develop` and the API client is regenerated.

**Back end** (`feat/s1-tender-publishing-backend`)

1. Prisma models and migration for the S1 tables.
2. Staff sign-in: sessions, refresh rotation, CSRF, and the authentication guard (A0–A5).
3. The access service and the employee tender endpoints (Q1–Q4).
4. Tender management (M1–M11) and the employee's document download (Q5), with the local file storage adapter ([ADR 0006](../05_ARCHITECTURE/ADR/0006_LOCAL_DISK_FILE_STORAGE.md)).
5. Public tender and reference endpoints (T1, T2, T2d, R1), with cache headers ([API contract §1.2](../05_ARCHITECTURE/API_CONTRACT.md#12-query-cache-and-http-caching)).
6. Seed script and audit events.

**Front end, public** (`feat/s1-tender-publishing-frontend-public`)

1. Regenerate the API client.
2. Tender list and tender detail screens.

**Front end, staff** (`feat/s1-tender-publishing-frontend-staff`)

1. Sign-in page and session handling ([API contract §1.1](../05_ARCHITECTURE/API_CONTRACT.md#11-session-csrf-refresh)).
2. Employee draft tender screens.
3. Officer screens, including the supplier bid form editor.

## Tests

[Standards §9](../04_RULES/ENGINEERING_STANDARDS.md#9-testing) and [coding standards §2.7 and §3.5](../04_RULES/CODING_STANDARDS.md#27-tests) apply. S1 must at least show:

- An employee reads and edits only their own tenders; any other tender returns `404`.
- An employee cannot edit after acceptance: `409 TENDER_STATUS_CHANGED`.
- A stale revision returns `409 VERSION_CONFLICT`.
- Weights not adding up to 100, deadlines out of order, or deadlines in the past are rejected.
- After publishing, the content, scoring, deadlines, Terms of Reference, and supplier bid form are read-only.
- Public endpoints return only `published` tenders, never the estimated balance or scoring, and fall back to the other language.
- A cancelled tender can be copied once; the copy starts at `accepted` with no deadlines.
- A `guest` cannot call any staff endpoint.
- The screens work in `/en` and `/ar`, including right-to-left layout.

## Done when

- The path above works end to end in `/en` and `/ar`, using the seeded accounts.
- Every S1 endpoint is in Swagger and in the Postman collection ([standards §7](../04_RULES/ENGINEERING_STANDARDS.md#7-api-design)).
- The [Definition of Done](../04_RULES/ENGINEERING_STANDARDS.md#11-definition-of-done) holds for each task.
- The README lists the demo accounts and the seed command.

## Open points

None. The sign-in tools are settled in [ADR 0004](../05_ARCHITECTURE/ADR/0004_TECHNOLOGY_STACK.md): `cookie-parser`, `@nestjs/throttler`, and `csrf-csrf`.

## Verification — November 24, 2026

Automated tests only; no computer use or browser automation.

| Check | Result |
|---|---|
| Back-end unit tests: `cd backend && npm test` | 18 passed in 7 files |
| API/database tests: `cd backend && npm run test:e2e` | 64 passed in 9 files, against local PostgreSQL |
| Front-end tests: `cd frontend && npm test` | 105 passed in 19 files |
| Swagger and collection coverage | All 27 Swagger operations appear in the [Postman v2.1 collection](../postman/b4f-akf-tender-supplier-management.postman_collection.json); an additional request follows the returned signed file URL |

The API tests cover the full employee → officer → public publishing path separately in English and Arabic, including a draft edit, scoring, Terms of Reference, a custom supplier field, publication, and a public file download. Existing tests cover ownership/404, revision conflicts, status-before-validation checks, invalid weights/deadlines, publication locks, copying once without deadlines, public confidentiality, language fallback, cookies/CSRF, refresh replay, and seed repeatability.

Front-end tests cover public browsing, sign-in/session handling, employee drafts, officer management, documents, the supplier form editor, publication validation, copying, and page-level role guards. Their API calls are mocked; they do not establish a live browser-to-API flow or visual acceptance.

Swagger now documents the shared error envelope, session/CSRF errors, invisible records, upload failures and rate-limit timing. Documentation tests check operation coverage, request bodies, script syntax, and transient CSRF acquisition. Signed-file transport remains intentionally excluded from Swagger: clients follow the returned URL rather than constructing it ([ADR 0006](../05_ARCHITECTURE/ADR/0006_LOCAL_DISK_FILE_STORAGE.md)).

### Remaining acceptance items

- Review the implementation against this specification and the agreed visual design.
- The collection has not been executed in the Postman runtime; its structure, examples and scripts have automated checks. Its cookie-jar behavior still needs runtime confirmation.
- No browser verification, production build, lint or separate typecheck was run during this closeout; verification followed the current automated-test-files-only rule.
- Human slice acceptance is not recorded.

## Web follow-up — November 24, 2026

- Added the role-aware responsive sidebar and signed-in account view. The header retains language switching, profile access and sign-out.
- Replaced employee tender section links with real horizontal tabs. Draft inputs survive tab changes; Save validates the whole form and opens/focuses the first invalid section. Detail tabs separate basic information, translations and Terms of Reference.
- Shared buttons have stronger borders, clearer primary/secondary states and consistent modest rounding; navigation/profile spacing and focus states were refined.
- A later front-end run recorded 180 passing tests, a passing production build and TypeScript check. Full lint still reported the existing sign-up-form ref error. This later count includes S2 coverage and does not replace the earlier S1-only snapshot.
- Later checks of the whole snapshot are in the [closeout checkpoint](../HACKATHON_ROADMAP.md#closeout-checkpoint--november-24-2026).
