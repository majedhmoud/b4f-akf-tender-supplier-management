# Team 2 Hackathon Plan: Tender and Supplier Management Platform (AKF)

Hi team, this is how we work for the next four days.

## Key dates

| Day | Date | What happens |
|---|---|---|
| Day 1 | Sun, Nov 22 (half day) | P0 Problem and scope |
| Day 2 | Mon, Nov 23 | P1 System design (morning), V1 slices start (afternoon) |
| Day 3 | Tue, Nov 24 | V1 slices until the 13:00 code freeze, final touches 13:00–15:30, **hand-in by 15:30 (deadline 16:00)** |
| Day 4 | Wed, Nov 25 | **Presentation** to our internship instructors |

We each plan for about 8 working hours a day.

## What we hand in

- Four Word files: Project Brief and Analysis and Design study, in Arabic and English
- Repository link, with `backend/`, `frontend/`, `mobile/`, the README, the Postman collection, and demo accounts
- Demo URL, if available
- Slides and a backup demo video for the presentation
- Details: [SUBMISSION_REQUIREMENTS.md](01_PROBLEM/SUBMISSION_REQUIREMENTS.md)

## Phases and slices

The phases (P0–P5) and the seven slices (S1–S7) are in the [hackathon roadmap](HACKATHON_ROADMAP.md).

## How we split the work

- Every phase is broken into small tasks. Each task has **one owner and one reviewer**.
- Each slice is split into a backend and a client task. S7 uses a NestJS backend task and an Expo client task against the same API contract.
- When you finish a task, **claim the next unclaimed one**. Whoever has completed the fewest tasks picks first, which keeps the load fair.

## How we decide

- Propose each task for human verification. Codex and Claude can give review feedback.
- The human decides. **ACCEPT** means carry out the proposal. **MODIFY** means revise and resubmit it. **REJECT** means stop the task.
- Commit only at points we trust and can return to.
- Branches, pull requests, merges, and tags follow [`docs/04_RULES/GIT_WORKFLOW.md`](04_RULES/GIT_WORKFLOW.md): work on a task branch from `develop`, commit from your own GitHub account, follow the review rule and owner exception, and merge it with a merge commit (never squash).

## Words we use

Use the terms in the [glossary](GLOSSARY.md) everywhere: in code, documents, and conversation.
