# S4 Bid Submission

Path: an `active` supplier opens a `published` tender → submits a bid with all three parts and their required files before the application deadline → sees it in My bids → replaces each part until that part's own deadline.

Sources: [API contract B1–B6](../05_ARCHITECTURE/API_CONTRACT.md#bids), [ERD, Bids](../05_ARCHITECTURE/ERD.md#bids), [workflows](../01_PROBLEM/WORKFLOWS.md).

## Scope

| Endpoint | Behaviour |
|---|---|
| B1 `GET /tenders/:tenderId/bid-form` | Standard and custom fields per part, with English/Arabic labels; `canSubmit` and its reason |
| B2 `POST /tenders/:tenderId/bids` | Multipart, `Idempotency-Key`; all three parts, files and answers in one transaction; a random bidder code per tender |
| B3, B3d `GET /me/bids`, `GET /me/bids/:bidId` | The supplier's own bids; tender status, part deadlines and locks only |
| B4 `PUT /me/bids/:bidId/parts/:partType` | Replaces one part in full before its deadline, also while suspended; a failure changes nothing |
| B6 `GET /me/bids/:bidId/documents/:docId/download` | Signed link to one of the supplier's own files |

Decisions (November 24, 2026): standard field values are stored in `BID_PART.standard_answers`; `BID_PART_DOCUMENT.kind` names the standard document; bid document translations (B5) are postponed after V1; the officer's view of received bids comes with S5 and S6.

## Screens

| Route | Behaviour |
|---|---|
| `/tenders/[tenderId]` | Submit a bid, or the reason the supplier cannot, or View my bid |
| `/tenders/[tenderId]/bid` | The bid form, with the reminder not to identify the company in technical and financial files |
| `/my-bids`, `/my-bids/[bidId]` | The list, and each part with Download and Replace while unlocked |

## Out of scope

Translations (B5), the lifecycle job that closes tenders at the application deadline, evaluation (S5) and award (S6).

## Status

November 24, 2026: implemented in the back end and web app. No automated tests were written or run, by Majed's decision.

## Current work split

| Workstream | Next task | State |
|---|---|---|
| Back end | Active Cedar Supplies demo account; preserve Wadi setup fixture; future published deadlines; safe bid/file reset cleanup | Seed/reset source reviewed; static checks pass; local reload not confirmed |
| Back-end review | Deadline locking, uncertain-commit file cleanup, required-text validation and upload/access check order | Source corrections reviewed; static checks pass; runtime outcomes unverified |
| Front end | Idempotency keys on deliberate edits, retry waits, required-text checks, bid-list pagination and visible loading/error states | Implemented; static checks pass; no runtime verification |
| Documentation | Keep this checkpoint and the roadmap aligned with actual implementation and checks | In progress |

The S4 baseline passes TypeScript, lint, formatting and production builds in both apps; the database/schema comparison reports no differences. These static checks do not demonstrate runtime correctness. No test files are created or run. Demo accounts are added to the README only when their seed definition is implemented. Whole-slice acceptance remains pending; S5 is a separate proposal.

### Front-end correction checkpoint

Accepted corrections are implemented: B2/B4 retain their key on unchanged retries, rotate it on deliberate edits and block duplicate requests. `IDEMPOTENCY_IN_PROGRESS` enforces a one-second wait; rate limits honor Retry-After; a reused-key response requires an edit before retrying. Required custom text rejects whitespace-only values. My bids uses URL-backed pages and user/locale/page query keys. B1 load failures and replacement-spec failures have visible retry states; validation has translated fallback messages, including when a field path cannot be mapped.

Front-end TypeScript, ESLint, Prettier and production build pass. No test files were created or run and no browser automation was used. These checks do not establish runtime correctness. Backend seed/reset work and backend review corrections remain separate; human S4 acceptance is still pending. No typos were fixed.

### Latest source reconciliation

Current seed code includes an active Cedar Supplies fixture (`supplier@cedar.demo.test`, shared demo password) while retaining Wadi's pending setup. Reset now gathers bid-document storage keys and deletes bids before suppliers. Bid writes also use an unreferenced-file cleanup helper after errors/replays. These source changes have been observed, not accepted as verified fixes. The latest backend handoff, focused review and static checks are still required; the local database has not been reloaded during this reconciliation. S5 remains a separate proposal, and no tests are created or run.

### Backend source/static review checkpoint

The latest source adds tender `FOR SHARE` locks for B2/B4 before checking current deadlines, a visibility/ownership guard before upload interception, trimmed required text, and database-reference checks before discarding newly uploaded files. Reset gathers bid storage keys and removes bids before suppliers. Cedar is active with the shared demo password in the seed definition; Wadi retains setup pending, and the two published fixtures have future relative deadlines.

Both apps pass TypeScript, ESLint, Prettier and production build. Prisma reports no database/schema differences. API, web, Redis and Mailpit remain running. No test files were created or run, and no browser automation was used. The updated seed has not been loaded during this review; account availability and runtime failure/concurrency behavior remain unconfirmed. The S5 lifecycle implementation must use a lock order compatible with B2/B4; a shared tender lock is not a replacement for the lifecycle job itself. S3 approval-order/concurrency findings remain separate and open. Human S4 acceptance is pending.
