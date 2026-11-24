# Hackathon Roadmap

The path for developing the product. Steps 1–7 are done once; steps 8–14 repeat for every slice. Step folders are created when they get their first file.

| # | Step | Output | Status |
|---|---|---|---|
| 1 | Understand the real problem: who needs this and why, before any code. | [01_PROBLEM/](01_PROBLEM/), [GLOSSARY.md](GLOSSARY.md) | Done |
| 2 | Inspect what already exists: real code, real API, real design. Don't assume. | [02_EXISTING/](02_EXISTING/), [SUBMISSION_REQUIREMENTS.md](01_PROBLEM/SUBMISSION_REQUIREMENTS.md) | In progress (Team Brief pending review) |
| 3 | Define the first useful scope: what V1 means, and what is deliberately postponed. | [03_SCOPE/V1_SCOPE.md](03_SCOPE/V1_SCOPE.md) | Done |
| 4 | Write the rules: engineering standards, before feature code exists. | [AGENTS.md](../AGENTS.md), [04_RULES/](04_RULES/) | Done (engineering standards and Git workflow accepted) |
| 5 | Decide architecture boundaries: how the pieces may talk to each other, decided once for the whole app. | [05_ARCHITECTURE/](05_ARCHITECTURE/) | Core design accepted, including ADRs 0001–0008 |
| 6 | Choose one small slice: a thin, complete path through every layer. | [06_SLICES/](06_SLICES/) | S1–S7 implemented; see the slice status below |
| 7 | Verify real external contracts: check what an outside system actually does. | [07_CONTRACTS/ACCOUNT_SETUP_EMAIL.md](07_CONTRACTS/ACCOUNT_SETUP_EMAIL.md) | Executed previously; delivery review findings remain open; latest changes not retested |
| 8 | Propose the task and its intended outcome. | Per task | — |
| 9 | A human verifies the proposal. | Per task | — |
| 10 | The human chooses ACCEPT, MODIFY, or REJECT. | Per task | — |
| 11 | Act on the accepted proposal. | Per task | — |
| 12 | Verify with evidence: diff, typecheck, tests, the running app, real data. | Per slice | — |
| 13 | Record a known Git state: commit at a point you can trust. | Git history, [04_RULES/GIT_WORKFLOW.md](04_RULES/GIT_WORKFLOW.md) | Ready: main and develop set up |
| 14 | Repeat for the next slice, feature, or decision. | — | — |

## Hackathon plan

Status: accepted.

- Day 1–3 (Nov 22–24): build. Hand-in on Tue Nov 24 at 16:00 (official deadline; see [SUBMISSION_REQUIREMENTS.md](01_PROBLEM/SUBMISSION_REQUIREMENTS.md)).
- Day 4 (Nov 25): presentation to our internship instructors. We present the product; it is not deployed.
- Budget: 8 hours a day per person; day 1 counts as half a day.

### Phases

| Phase | When | Hours | Steps | Output | Status |
|---|---|---|---|---|---|
| P0 Problem and scope | Day 1 (Nov 22), rest of the day | ~4 | 1, 3, 4 | Workflow gaps settled; `03_SCOPE/V1_SCOPE.md` with postponed items; Git repository; technology stack accepted (ADR 0004); main role for each member (for the Project Brief) | Done; member roles are in the Project Brief and the [README](../README.md#team-members) |
| P1 System design | Day 2 (Nov 23), morning | 4 | 5, 7 | ERD, architecture diagram (Next.js, NestJS, React Native, database, external services), at least 3 use cases with scenarios, use case diagram, class diagram, API contract, design criteria, completed capability matrix, ADRs, account setup email checked | Core design accepted, including [mobile sign-in](05_ARCHITECTURE/ADR/0007_SUPPLIER_MOBILE_SIGN_IN.md). [Email delivery review follow-up](07_CONTRACTS/ACCOUNT_SETUP_EMAIL.md#review-follow-up) remains separate. |
| P2 V1 slices | Day 2 afternoon → Day 3 midday | ~9 | 6, 8–14 | Coding starts here. S1 together (2h), then S2 + S3 in parallel, then S4 + S5 + S6 in parallel, then S7 Mobile. Each slice adds its endpoints to Swagger and the Postman collection | S1–S7 are in the closeout snapshot. |
| Code freeze | Day 3 (Nov 24), 13:00 | — | — | Only fixes, demo data, and polish after this point | — |
| P3 Final touches and optimizations | Day 3, 13:00–15:30 | ~2.5 | 12, 13 | UI polish, diagrams, README, demo seed, environment examples and mobile demo | Responsive web changes, mobile UI, run instructions, the seed and three `.env.example` files are in the snapshot. See the [closeout checkpoint](#closeout-checkpoint--november-24-2026). |
| P4 Hand-in | Day 3, by 15:30 (deadline 16:00) | — | — | Project Brief and Analysis and Design study in Arabic and English; repository link and Postman collection | The four Word documents are in [docs/HAND_IN/](HAND_IN/). No submission is recorded in the repository. |
| P5 Presentation | Day 4 (Nov 25) | — | — | Problem story and S1–S7 walkthrough | Scheduled presentation milestone. |

### Slices

Each slice goes through every layer. Running S1–S7 in order is the demo.

| Slice | Path | Status |
|---|---|---|
| S1 Tender publishing | `employee` creates a draft tender → `procurement_officer` accepts and publishes it → a `guest` sees it ([spec](06_SLICES/S1_TENDER_PUBLISHING.md)) | Implemented. Automated tests recorded at the S1 checkpoint. |
| S2 Supplier sign-up | `guest` submits legal information → `legal_committee` accepts and raises the request → `admin` accepts → supplier sets a password through the account setup link; profile and supplier administration ([spec](06_SLICES/S2_SUPPLIER_SIGNUP.md)) | Implemented: application, reviews, account setup, profile and supplier administration. Technical documents are not shipped in V1. |
| S3 Committees | `procurement_officer` raises committees → `admin` approves members and registers their accounts ([spec](06_SLICES/S3_COMMITTEES.md)) | Implemented. No S3 automated tests were written. |
| S4 Bid submission | An active supplier submits all three parts and required files before the application deadline. Late new bids are rejected; existing parts can be replaced until their own deadlines. ([spec](06_SLICES/S4_BID_SUBMISSION.md)) | Implemented. Static checks passed; no S4 automated tests were written. |
| S5 Sealed evaluation | Legal, Technical and Financial Evaluations, with technical and financial hidden from each other ([spec](06_SLICES/S5_SEALED_EVALUATION.md)) | Implemented. Majed checked the web screens locally; no integrated S5-to-S6 run is recorded. |
| S6 Award | System ranks and awards the top bid; the officer breaks ties, reviews drafts, and sends emails ([spec](06_SLICES/S6_AWARD.md)) | Implemented: ranking, award, tie break and officer emails. The seeded tie was checked at the API. Contact Supplier is not shipped in V1. |
| S7 Mobile | Guests browse public tenders; suppliers sign in and track their bids in Expo ([spec](06_SLICES/S7_SUPPLIER_COMPANION.md)) | Implemented, including mobile supplier sessions. See the [S7 checkpoint](06_SLICES/S7_SUPPLIER_COMPANION.md#verification-and-status). |

### Closeout checkpoint — November 24, 2026

This is the canonical record of what the closeout snapshot ships and what was verified. Slice documents keep their own dated checkpoints as history.

**Ships:** S1–S7 on one NestJS API and one PostgreSQL database: the Next.js web app in English and Arabic with right-to-left layout, following [ADR 0008](05_ARCHITECTURE/ADR/0008_RESPONSIVE_ACCESSIBLE_WEB_PATTERNS.md), and the Expo supplier companion with mobile sessions under [ADR 0007](05_ARCHITECTURE/ADR/0007_SUPPLIER_MOBILE_SIGN_IN.md). Items agreed but not shipped are listed in [V1 scope](03_SCOPE/V1_SCOPE.md#postponed).

**Recorded checks:**

- Web: production build and TypeScript passed, and the recorded run passed 180 tests in 27 files.
- Backend: TypeScript and build passed. The four suites affected by S7 passed 25 integration tests against disposable PostgreSQL and Redis. The last full backend run on record (21 unit and 109 e2e tests) predates S3–S7.
- Mobile: TypeScript, lint, and iOS and Android bundle exports passed. The mobile app has no automated tests.

**Not recorded:** a full backend test run on the closeout tree, S3–S6 automated tests, an integrated S5-to-S6 run with email delivery, a Postman runtime run, a device walkthrough of the mobile app, and human acceptance of each slice. The four team audits in [08_TEAM_REVIEWS/](08_TEAM_REVIEWS/) are historical records of earlier states.

**Hand-in documents:** the four Word files in [HAND_IN/](HAND_IN/) describe S1–S7 and link to this repository.

### Team split

- Every phase is broken into small tasks. Each task has one owner and one reviewer.
- In P2, slices split into backend and client tasks against the API contract. For S7, the backend task adds mobile sessions to the shared API, and the client task builds the Expo app.
- When you finish a task, claim the next unclaimed one. Whoever has completed the fewest tasks picks first.
- In P1, the design outputs are split across people. The API contract waits for the ERD's main entities.
- Each member commits their own tasks from their own GitHub account (see [GIT_WORKFLOW.md](04_RULES/GIT_WORKFLOW.md)).

### Decisions

- For every task, propose the work and have a human verify it. Codex and Claude can flag issues during review.
- ACCEPT authorizes the proposed work. MODIFY means revise the proposal and return it for human verification. REJECT stops the task.
- The Team Brief stays pending review and is not part of this plan.
