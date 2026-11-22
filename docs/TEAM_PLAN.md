# Team 2 Hackathon Plan: Tender and Supplier Management Platform (AKF)

Hi team, this is how we work for the next four days.

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

## Phases and slices

The phases (P0–P5) and the six slices (S1–S6) are in the [hackathon roadmap](HACKATHON_ROADMAP.md).

## How we split the work

- Every phase is broken into small tasks. Each task has **one owner and one reviewer**.
- Each slice is split into a back-end task and a front-end task. Both follow the API contract, so nobody waits for anyone.
- When you finish a task, **claim the next unclaimed one**. Whoever has completed the fewest tasks picks first, which keeps the load fair.

## How we decide

- Propose each task for human verification. Codex and Claude can give review feedback.
- The human decides. **ACCEPT** means carry out the proposal. **MODIFY** means revise and resubmit it. **REJECT** means stop the task.
- Commit only at points we trust and can return to.
- Branches, pull requests, merges, and tags follow [`docs/04_RULES/GIT_WORKFLOW.md`](04_RULES/GIT_WORKFLOW.md): work on a task branch from `develop`, have your reviewer approve the PR, and squash-merge it.

## Words we use

Use the terms in the [glossary](GLOSSARY.md) everywhere: in code, documents, and conversation.
