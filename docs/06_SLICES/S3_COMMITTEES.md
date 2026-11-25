# S3 Committees

Path: the `procurement_officer` raises a tender's committees and nominates members by name and email → the `admin` approves or rejects each nomination → an approved member without an account gets one, with an account setup email → members see their tenders in My assignments.

Sources: [API contract C1–C7](../05_ARCHITECTURE/API_CONTRACT.md#committees), [ERD, Committees](../05_ARCHITECTURE/ERD.md#committees), [capability matrix](../05_ARCHITECTURE/CAPABILITY_MATRIX.md).

## Scope

| Area | Endpoints | Behaviour |
|---|---|---|
| Officer | C1–C4 | Raise legal, technical and financial committees while the tender is `accepted`, `published` or `closed`; nominate; withdraw a waiting nomination |
| Admin | C5–C6 | Nomination queue, oldest first; approve (with the account language for a new person) or reject |
| Member | C7 | My assignments; `stage` is `waiting` until bids exist (S4) |

Approval checks, in order: one committee per person per tender, the tender's requesting `employee`, `procurement_officer` or `admin` accounts, then the tender status. A new account is `pending_setup` with no role; its first setup link and email are created with the approval, and the shared [account setup](../07_CONTRACTS/ACCOUNT_SETUP_EMAIL.md) flow activates it.

## Screens

| Route | Behaviour |
|---|---|
| `/manage/tenders/[tenderId]` | Committees section: raise, nominate, withdraw |
| `/admin/committee-nominations` | Approve or reject, with the account language for a new person |
| `/my-assignments` | The signed-in user's approved assignments |

## Out of scope

Evaluation (S5), assignment counts from bids (S4), and editing or removing an approved member.

## Status

November 24, 2026: implemented in the back end and web app. No automated tests were written or run, by Majed's decision.

## Demo fixtures

The seed creates all three committee types on each accepted/published demo tender. It adds one pending legal nomination on the accepted tender (`nominee@akf.org`, no account yet), and one approved technical member on the first published tender (`member@akf.org`, active account with no role). The approved member uses the existing demo password documented in the [README](../../README.md#demo-accounts).

The reset removes demo assignment audit records, assignments, committees, recipient emails and accounts; setup tokens follow account deletion. It recreates the fixtures without changing non-demo accounts. Running the seed resets demo work, including approvals performed during the walkthrough. No tests were created or run; slice acceptance and the reported S3 review findings remain pending.

### Fixture/check update

The S3 seed was loaded once into the local database. It reports five demo accounts, including the approved committee member, and one waiting nomination. The seed build and local load succeeded; no repeatability test was run.

The sign-up form's headers object now uses stable state instead of reading a ref during render, preserving the idempotency-header behavior. Front-end lint passes. Back-end typecheck, lint, formatting, build (through the seed command) and schema comparison pass. At that check, the full front-end typecheck and build were blocked by a bid-screen type error in `BidPartInputs.tsx:51`. Both pass in the [closeout checkpoint](../HACKATHON_ROADMAP.md#closeout-checkpoint--november-24-2026). No test files were created or run.
