# Hackathon Roadmap

The path for developing the product. Steps 1–7 are done once; steps 8–14 repeat for every slice. Step folders are created when they get their first file.

| # | Step | Output | Status |
|---|---|---|---|
| 1 | Understand the real problem: who needs this and why, before any code. | [01-problem/](01-problem/), [GLOSSARY.md](GLOSSARY.md) | In progress |
| 2 | Inspect what already exists: real code, real API, real design. Don't assume. | [02-existing/](02-existing/) | In progress (Team Brief pending review) |
| 3 | Define the first useful scope: what V1 means, and what is deliberately postponed. | `03-scope/` | Not started |
| 4 | Write the rules: engineering standards, before feature code exists. | [AGENTS.md](../AGENTS.md), [04-rules/](04-rules/) | Started (documentation and Git rules) |
| 5 | Decide architecture boundaries: how the pieces may talk to each other, decided once for the whole app. | [05-architecture/](05-architecture/) | Started (ADRs, capability matrix) |
| 6 | Choose one small slice: a thin, complete path through every layer. | `06-slices/` | Not started |
| 7 | Verify real external contracts: check what an outside system actually does. | `07-contracts/` | Not started |
| 8 | Propose the task and its intended outcome. | Per task | — |
| 9 | A human verifies the proposal. | Per task | — |
| 10 | The human chooses ACCEPT, MODIFY, or REJECT. | Per task | — |
| 11 | Act on the accepted proposal. | Per task | — |
| 12 | Verify with evidence: diff, typecheck, tests, the running app, real data. | Per slice | — |
| 13 | Record a known Git state: commit at a point you can trust. | Git history, [04-rules/GIT_WORKFLOW.md](04-rules/GIT_WORKFLOW.md) | Ready: repository set up; `develop` not created yet |
| 14 | Repeat for the next slice, feature, or decision. | — | — |

## Hackathon plan

Status: accepted.

- Day 1–3 (Nov 22–24): build. Hand-in at the end of Nov 24.
- Day 4 (Nov 25): presentation to our internship instructors. The product is handed to the AKF.
- Budget: 8 hours a day per person; day 1 counts as half a day.

### Phases

| Phase | When | Hours | Steps | Output | Status |
|---|---|---|---|---|---|
| P0 Problem and scope | Day 1 (Nov 22), rest of the day | ~4 | 1, 3, 4 | Workflow gaps settled; `03-scope/V1_SCOPE.md` with postponed items; Git repository; technology stack accepted (ADR 0004) | Not started |
| P1 System design | Day 2 (Nov 23), morning | 4 | 5, 7 | ERD, use case diagram, class diagram, API contract, design criteria, completed capability matrix, ADRs, verification email checked | Not started |
| P2 V1 slices | Day 2 afternoon → Day 3 midday | ~9 | 6, 8–14 | Coding starts here. S1 together (2h), then S2 + S3 in parallel, then S4 + S5 + S6 in parallel | Not started |
| Code freeze | Day 3 (Nov 24), ~3h before the end | — | — | Only fixes, demo data, and polish after this point | — |
| P3 Final touches and optimizations | Day 3, last ~3h | ~3 | 12, 13 | Bugs fixed, demo data, UI polish, slow spots fixed, diagrams match the code, final commit | Not started |
| P4 Hand-in | End of Day 3 | — | — | Repository link, slides, documentation (ERD, ADRs, class diagram, use case diagram), backup demo video | Not started |
| P5 Presentation | Day 4 (Nov 25) | — | — | Rehearsal, then problem story + live S1–S6 demo, with the video as backup | Not started |

### Slices

Each slice goes through every layer. Running S1–S6 in order is the demo.

| Slice | Path | Status |
|---|---|---|
| S1 Tender publishing | `requester` creates a draft tender → `procurement_officer` accepts and publishes it → a `guest` sees it | Not started |
| S2 Supplier sign-up | `guest` submits legal information → `legal_committee` accepts → `admin` creates the account → email verified | Not started |
| S3 Committees | `procurement_officer` raises committees → `admin` approves members and registers their accounts | Not started |
| S4 Bid submission | `supplier` submits legal information, technical offer and financial offer → rejected after the deadline | Not started |
| S5 Sealed evaluation | Legal, Technical and Financial Evaluations, with technical and financial hidden from each other | Not started |
| S6 Award | committees → `procurement_officer` receives the winning supplier and contacts them | Not started |

### Team split

- Every phase is broken into small tasks. Each task has one owner and one reviewer.
- In P2, each slice is split into a back-end task and a front-end task, both built against the API contract, so nobody waits for anyone.
- When you finish a task, claim the next unclaimed one. Whoever has completed the fewest tasks picks first.
- In P1, the design outputs are split across people. The API contract waits for the ERD's main entities.

### Decisions

- For every task, propose the work and have a human verify it. Codex and Claude can flag issues during review.
- ACCEPT authorizes the proposed work. MODIFY means revise the proposal and return it for human verification. REJECT stops the task.
- The Team Brief stays pending review and is not part of this plan.
