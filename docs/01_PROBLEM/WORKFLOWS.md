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
| `draft tender` → `accepted` | `procurement_officer` accepts it |
| `accepted` → `published` | `procurement_officer` publishes it |
| `published` → `closed` | Automatically at the application deadline. No new bidders; existing bidders can still submit their technical and financial parts on time. |
| `closed` → `under_evaluation` | Automatically at the financial deadline |
| `under_evaluation` → `awarded` | `procurement_officer` receives the winning supplier |

Open: who chooses the winning supplier.

## Bid submission

1. Each **bid part** is due by its own deadline:
   - legal information by the application deadline
   - technical offer by the technical deadline
   - financial offer by the financial deadline
2. Until its deadline, the owning `supplier` may replace a bid part. Earlier versions are not kept.
3. After its deadline, a bid part is locked.
