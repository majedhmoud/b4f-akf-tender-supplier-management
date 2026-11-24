# S6 Award

Path: the Financial Evaluation completes → the system ranks the eligible bids → a unique top score is awarded automatically, or the `procurement_officer` chooses among bids tied at the top → the officer reviews and sends one email per bidder.

Sources: [workflows](../01_PROBLEM/WORKFLOWS.md#evaluation-and-award), [ERD, Scoring and award and Emails](../05_ARCHITECTURE/ERD.md#scoring-and-award), [API contract W1–W3 and E1–E5](../05_ARCHITECTURE/API_CONTRACT.md#award).

## Scope

| Area | Behaviour |
|---|---|
| Ranking | In the evaluation transaction that completes the financial stage: `combined_score = (technical_weight × technical_score + financial_weight × financial_score) / 100` (two decimals) and the above-estimated-balance flag, for every bid that met the minimum. Equal scores share a rank. |
| Award | A unique top score: `top_rank`, tender `awarded`, in the same transaction. A tie: the tender stays `under_evaluation` with `tie_break_required`. |
| W1–W3 | Award status with progress per stage; the ranking (names and scores, no bid contents, prices or bidder codes); the tie break (`Idempotency-Key`; `409 TIE_BREAK_NOT_REQUIRED`, `409 ALREADY_AWARDED`, `422 BID_NOT_TIE_CANDIDATE`) |
| Emails | At award: one draft per bidder (`award_winner`, `award_other`); at a `no_qualified_bid` cancellation: one `cancellation` draft per bidder. Each in the supplier's language at preparation, with no scores for other bidders. |
| E1–E5 | List, detail, edit (revision check; `409 VERSION_CONFLICT`, `409 EMAIL_NOT_EDITABLE`), send or retry one, send all reviewed. A send claims the reviewed revision only from `draft` or `failed`, so a delivery is scheduled once; the existing email queue delivers it. |

Audited: ranking calculated, tender awarded, tie broken.

## Screens

The managed tender page (`/manage/tenders/[tenderId]`) gains an Evaluation and award section (progress, ranking, Choose winner on tied rows with a confirm step) and an Emails section (preview in the email's language and direction, Edit, Send, Retry, Send all reviewed; polling every 3 seconds for at most 60 seconds while sending).

## Decisions (November 24, 2026)

- Plain award and cancellation templates in English and Arabic, with the tender title and supplier name only; the officer edits them before sending.
- Contact Supplier (E6) and the officer's supplier views (P6, P7) are later.
- Send one and Send all accept an `Idempotency-Key` but do not require it: a send is idempotent by the reviewed revision.

## Demo fixtures

"Water pumps for farming cooperatives" is seeded `under_evaluation` with both demo bids evaluated to a tie at 75.00, waiting for the officer (`officer@akf-demo.test`). Completing the S5 walkthrough on "Solar panels for health clinics" ranks it and awards a unique top score automatically.

## Status

November 24, 2026: implemented in the back end and web app. No automated tests were written or run, by Majed's decision.
