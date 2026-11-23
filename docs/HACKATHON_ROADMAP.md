# Hackathon Roadmap

The path for developing the product. Steps 1–7 are done once; steps 8–14 repeat for every slice. Step folders are created when they get their first file.

| # | Step | Output | Status |
|---|---|---|---|
| 1 | Understand the real problem: who needs this and why, before any code. | [01_PROBLEM/](01_PROBLEM/), [GLOSSARY.md](GLOSSARY.md) | Done |
| 2 | Inspect what already exists: real code, real API, real design. Don't assume. | [02_EXISTING/](02_EXISTING/), [SUBMISSION_REQUIREMENTS.md](01_PROBLEM/SUBMISSION_REQUIREMENTS.md) | In progress (Team Brief pending review) |
| 3 | Define the first useful scope: what V1 means, and what is deliberately postponed. | [03_SCOPE/V1_SCOPE.md](03_SCOPE/V1_SCOPE.md) | Done |
| 4 | Write the rules: engineering standards, before feature code exists. | [AGENTS.md](../AGENTS.md), [04_RULES/](04_RULES/) | Done (engineering standards and Git workflow accepted) |
| 5 | Decide architecture boundaries: how the pieces may talk to each other, decided once for the whole app. | [05_ARCHITECTURE/](05_ARCHITECTURE/) | Started (ERD, API contract, capability matrix, architecture, use cases, class diagram, design criteria and ADRs 0001–0005 accepted; mobile sign-in ADR pending) |
| 6 | Choose one small slice: a thin, complete path through every layer. | `06_SLICES/` | Not started |
| 7 | Verify real external contracts: check what an outside system actually does. | `07_CONTRACTS/` | Not started |
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
| P0 Problem and scope | Day 1 (Nov 22), rest of the day | ~4 | 1, 3, 4 | Workflow gaps settled; `03_SCOPE/V1_SCOPE.md` with postponed items; Git repository; technology stack accepted (ADR 0004); main role for each member (for the Project Brief) | In progress (member roles pending) |
| P1 System design | Day 2 (Nov 23), morning | 4 | 5, 7 | ERD, architecture diagram (Next.js, NestJS, React Native, database, external services), at least 3 use cases with scenarios, use case diagram, class diagram, API contract, design criteria, completed capability matrix, ADRs, account setup email checked | Started (accepted: [ERD](05_ARCHITECTURE/ERD.md), [API contract](05_ARCHITECTURE/API_CONTRACT.md), [capability matrix](05_ARCHITECTURE/CAPABILITY_MATRIX.md), [architecture](05_ARCHITECTURE/ARCHITECTURE.md), [use cases](05_ARCHITECTURE/USE_CASES.md), [class diagram](05_ARCHITECTURE/CLASS_DIAGRAM.md), [design criteria](05_ARCHITECTURE/DESIGN_CRITERIA.md); remaining: account setup email check, mobile sign-in ADR) |
| P2 V1 slices | Day 2 afternoon → Day 3 midday | ~9 | 6, 8–14 | Coding starts here. S1 together (2h), then S2 + S3 in parallel, then S4 + S5 + S6 in parallel, then S7 Mobile. Each slice adds its endpoints to Swagger and the Postman collection | Not started |
| Code freeze | Day 3 (Nov 24), 13:00 | — | — | Only fixes, demo data, and polish after this point | — |
| P3 Final touches and optimizations | Day 3, 13:00–15:30 | ~2.5 | 12, 13 | Bugs fixed, UI polish, slow spots fixed, diagrams match the code; README with all required sections; seed script with demo accounts; .env.example in backend/, frontend/, mobile/; Expo link or APK; final commit | Not started |
| P4 Hand-in | Day 3, by 15:30 (deadline 16:00) | — | — | Four Word files in docs/HAND_IN/ (Project Brief and Analysis and Design study, Arabic and English); repository link; demo URL if available; Postman collection; slides and backup demo video for P5 | Not started |
| P5 Presentation | Day 4 (Nov 25) | — | — | Rehearsal, then problem story + live S1–S7 demo, with the video as backup | Not started |

### Slices

Each slice goes through every layer. Running S1–S7 in order is the demo.

| Slice | Path | Status |
|---|---|---|
| S1 Tender publishing | `employee` creates a draft tender → `procurement_officer` accepts and publishes it → a `guest` sees it | Not started |
| S2 Supplier sign-up | `guest` submits legal information → `legal_committee` accepts and raises the request → `admin` accepts → supplier sets a password through the account setup link | Not started |
| S3 Committees | `procurement_officer` raises committees → `admin` approves members and registers their accounts | Not started |
| S4 Bid submission | An active supplier submits all three parts and required files before the application deadline. Late new bids are rejected; existing parts can be replaced until their own deadlines. | Not started |
| S5 Sealed evaluation | Legal, Technical and Financial Evaluations, with technical and financial hidden from each other | Not started |
| S6 Award | the system ranks the bids and awards the top-ranked one (`procurement_officer` breaks a tie at the top) → `procurement_officer` reviews and sends the award emails | Not started |
| S7 Mobile | `guest` or `supplier` browses tenders on mobile → `supplier` signs in and follows their bids (see [V1_SCOPE.md](03_SCOPE/V1_SCOPE.md#mobile-app-react-native-s7-supplier-companion)); built in `mobile/` against the same API | Not started |

### Team split

- Every phase is broken into small tasks. Each task has one owner and one reviewer.
- In P2, each slice is split into a back-end task and a front-end task (S7: a mobile task), all built against the API contract, so nobody waits for anyone.
- When you finish a task, claim the next unclaimed one. Whoever has completed the fewest tasks picks first.
- In P1, the design outputs are split across people. The API contract waits for the ERD's main entities.
- Each member commits their own tasks from their own GitHub account (see [GIT_WORKFLOW.md](04_RULES/GIT_WORKFLOW.md)).

### Decisions

- For every task, propose the work and have a human verify it. Codex and Claude can flag issues during review.
- ACCEPT authorizes the proposed work. MODIFY means revise the proposal and return it for human verification. REJECT stops the task.
- The Team Brief stays pending review and is not part of this plan.
