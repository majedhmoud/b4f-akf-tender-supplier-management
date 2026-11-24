# S5 Sealed Evaluation

Path: the deadline job moves a tender to `under_evaluation` at its financial deadline → the `legal_committee` passes or fails each bid → the `technical_committee` scores the passed bids, blind → the `financial_committee` scores the bids that met the minimum technical score, blind, and confirms each total price.

Sources: [workflows](../01_PROBLEM/WORKFLOWS.md#evaluation-and-award), [ERD](../05_ARCHITECTURE/ERD.md#sealed-blind-evaluation-enforced-by-the-access-service), [API contract L, X and F](../05_ARCHITECTURE/API_CONTRACT.md#evaluation-separate-dtos-absent-fields-are-never-sent), [capability matrix](../05_ARCHITECTURE/CAPABILITY_MATRIX.md).

## Scope

| Area | Behaviour |
|---|---|
| Deadline job | Every minute (BullMQ) and at start-up: `published` → `closed`, or `cancelled` (`no_bids`), at the application deadline; `closed` → `under_evaluation` at the financial deadline. Each change applies only from the expected status. |
| L1–L4 Legal | Every bid, with supplier identity and original file names; `pass` or `fail`, with a reason required for `fail` |
| X1–X4 Technical | Bids that passed Legal, by bidder code; one shared whole-number score 0–100 per bid; the system sets `meets_minimum` (score ≥ the tender's minimum) |
| F1–F4 Financial | Bids that met the minimum, by bidder code; score 0–100 and confirmed total price in the tender currency |
| C7 | `stage: open` and `pendingCount` while the committee has bids left to evaluate |

Access comes only from an approved assignment of the stage's committee type on the tender; anything else is 404. Technical and financial views never contain the bid ID, supplier identity, original file names, other parts or scores, scoring settings, the estimated balance or the ranking. Evaluations are insert-only: a repeat returns `409 ALREADY_SUBMITTED` with the saved evaluation.

Each evaluation locks the tender row and checks completion. A stage completes when the stage before it is complete and every bid eligible for it is evaluated. A complete stage that leaves no eligible bid cancels the tender with `no_qualified_bid`.

## Decisions (November 24, 2026)

- A stage completes only after the previous stage completes.
- A legal `fail` needs a reason (up to 2,000 characters).
- The capability matrix's committee columns mean approved assignments, not the standing `legal_committee` role.

## Boundary with S6

S5 stops when the financial evaluations are saved. Ranking, combined score, the above-balance flag, award, tie break and the officer's progress view (W1–W3) belong to S6. Until S6 exists, a tender stays `under_evaluation` after its financial stage completes. No document covers a tender that reaches `under_evaluation` with an unstaffed committee; evaluation waits.

## Demo fixtures

The seed adds a tender already `under_evaluation` ("Solar panels for health clinics"), with bids from the two active demo suppliers (Cedar Supplies and Rafid Works) and approved members: `legal-member@akf-demo.test` (legal), `member@akf-demo.test` (technical) and `finance-member@akf-demo.test` (financial), all with the demo password and no account role.

## Status

November 24, 2026: back end implemented. No automated tests were written or run, by Majed's decision. The web screens are pending.
