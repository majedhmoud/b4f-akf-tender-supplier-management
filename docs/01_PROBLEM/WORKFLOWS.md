# Workflows

Step-by-step processes, written in the terms of the [glossary](../GLOSSARY.md).

## supplier_signup_process

1. A `guest` explores the available tenders and fills in a form with their legal information.
2. The `legal_committee` accepts the legal information and raises the supplier's information to the `admin`.
3. The `admin` creates an account for the supplier.
4. The `procurement_officer` sends the supplier an email to verify their email address.
5. After verification, the supplier is registered and can continue filling in their technical information.

## Tender lifecycle

A **tender status** changes only through these transitions. Any other change is rejected.

| From → To | Triggered by |
|---|---|
| `draft tender` → `accepted` | `procurement_officer` accepts it and sets the **score weights** and the **minimum technical score** |
| `accepted` → `published` | `procurement_officer` publishes it. The score weights and minimum technical score are locked from here on. |
| `published` → `closed` | Automatically at the application deadline. No new bidders; existing bidders can still submit their technical and financial parts on time. |
| `published` → `cancelled` | Automatically at the application deadline, if the tender received no bids |
| `closed` → `under_evaluation` | Automatically at the financial deadline |
| `under_evaluation` → `awarded` | `procurement_officer` confirms the winning bid |
| `under_evaluation` → `cancelled` | Automatically, when an evaluation leaves no qualified bid |

A `cancelled` tender is final. The `procurement_officer` may copy it into a new tender, which starts at `accepted`:

- The details, score weights, and minimum technical score are copied, and can be edited.
- The deadlines and bids are not copied. The officer sets new deadlines and publishes it as usual.
- The new tender records which tender it was copied from.

## Bid submission

1. Each **bid part** is due by its own deadline:
   - legal information by the application deadline
   - technical offer by the technical deadline
   - financial offer by the financial deadline
2. Until its deadline, the owning `supplier` may replace a bid part. Earlier versions are not kept.
3. After its deadline, a bid part is locked.

## Evaluation and award

Each evaluation sees only the bids that passed the one before it.

1. **Legal Evaluation**: the `legal_committee` passes or fails each bid.
2. **Technical Evaluation**: the `technical_committee` gives each passed bid a **technical score**. Bids below the **minimum technical score** fail.
3. **Financial Evaluation**: the `financial_committee` checks each remaining financial offer and confirms its total bid price. Financial offers of failed bids are never opened.
4. The system calculates each bid's **financial score** and **combined score**, and ranks the bids from highest to lowest. Ties are assumed not to happen.
5. The `procurement_officer` sees the ranking with supplier names and scores, but not the bid contents. Bids priced above the **estimated balance** are flagged, not rejected.
6. The `procurement_officer` confirms the winning bid, and the tender becomes `awarded`.

The score weights are never shown to a `guest`, a `supplier`, or any committee. The estimated balance is never shown to a `guest` or a `supplier`.

## After the award

V1 ends at `awarded`. Contracts and delivery are handled outside the platform.

1. The platform prepares two emails from templates: one for the winning supplier, and one for each other bidder.
2. The `procurement_officer` reviews and edits them, then sends them.
3. Bidders who did not win receive no scores and no details about the winning bid.

When a tender is `cancelled`, the platform prepares a cancellation email from a template for every bidder, which the `procurement_officer` reviews and sends.

At any **tender status**, the `procurement_officer` can use **Contact Supplier** on a supplier's profile or bid entry to email the supplier's verified address.
