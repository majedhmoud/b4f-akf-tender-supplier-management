# Team 2 Hackathon Plan: Tender and Supplier Management Platform (AKF)

Hi team, this is the agreed plan for the next four days. The full version lives in `docs/HACKATHON_ROADMAP.md`.

## Key dates

| Day | Date | What happens |
|---|---|---|
| Day 1 | Sun, Nov 22 (half day) | P0 Problem and scope |
| Day 2 | Mon, Nov 23 | P1 System design (morning), V1 slices start (afternoon) |
| Day 3 | Tue, Nov 24 | V1 slices, code freeze ~3h before the end, final touches, **hand-in at end of day** |
| Day 4 | Wed, Nov 25 | **Presentation** to our internship instructors |

We each plan for about 8 working hours a day.

## What we hand in

- Repository link
- Slide presentation
- Written documentation: ERD, ADRs, class diagram, use case diagram
- Backup demo video

## Phases

1. **P0 Problem and scope (Day 1):** settle the open workflow questions, write the V1 scope with what we postpone, set up Git, and accept the technology stack.
2. **P1 System design (Day 2 morning):** ERD, use case diagram, class diagram, API contract, design criteria, and who-can-do-what (capability matrix).
3. **P2 V1 slices (Day 2 afternoon → Day 3 midday):** coding starts here. We build the product as six thin slices. Each slice goes through every layer, from screen to data.
4. **Code freeze (Day 3, ~3h before the end):** after this, only fixes, demo data, and polish.
5. **P3 Final touches and optimizations (Day 3):** fix bugs, polish the UI, update the diagrams to match the code, final commit.
6. **P4 Hand-in (end of Day 3).**
7. **P5 Presentation (Day 4):** short problem story, then a live demo of S1–S6, with the video as backup.

## The six slices

| Slice | What it shows |
|---|---|
| S1 Tender publishing | A requester creates a draft tender; the procurement officer accepts and publishes it; a guest can see it. |
| S2 Supplier sign-up | A guest submits legal information; the legal committee accepts; the admin creates the account; the supplier verifies their email. |
| S3 Committees | The procurement officer raises the committees; the admin approves the members and creates their accounts. |
| S4 Bid submission | A supplier submits a bid (legal information, technical offer, financial offer); late bids are rejected. |
| S5 Sealed evaluation | Legal, technical, and financial evaluations. The technical and financial committees can't see each other's work. |
| S6 Award | The committees send the winning supplier to the procurement officer, who contacts them. |

We build S1 together first. Then S2 and S3 run in parallel, then S4, S5, and S6 in parallel.

## How we split the work

- Every phase is broken into small tasks. Each task has **one owner and one reviewer**.
- Each slice is split into a back-end task and a front-end task. Both follow the API contract, so nobody waits for anyone.
- When you finish a task, **claim the next unclaimed one**. Whoever has completed the fewest tasks picks first, which keeps the load fair.

## How we decide

- Propose each task for human verification. Codex and Claude can give review feedback.
- The human decides. **ACCEPT** means carry out the proposal. **MODIFY** means revise and resubmit it. **REJECT** means stop the task.
- Commit only at points we trust and can return to.

## Words we use

We use these terms everywhere (full list in `docs/GLOSSARY.md`):

- **Tender**: what the AKF publishes, with three deadlines (application, technical, financial).
- **Draft tender**: the requester's proposal for a tender, before it has deadlines or committees.
- **Bid**: a supplier's application to a tender, with legal information, a technical offer, and a financial offer.
- **Users**: `admin` (AKF head manager), `procurement_officer`, `requester`, `legal_committee`, `technical_committee`, `financial_committee`, `supplier`, `guest`.
