# Workflows

Step-by-step processes, written in the terms of the [glossary](../GLOSSARY.md).

## supplier_signup_process

1. A `guest` explores the available tenders and fills in a form with their legal information. Every field is required.
2. The `legal_committee` conducts the **sign-up review**. If it accepts the legal information, it raises the sign-up request to the `admin`. If it rejects it, the sign-up ends.
3. The `admin` accepts the request without changing the details. The platform then creates the supplier account and emails an **account setup link**, in the language the `guest` used.
4. The supplier opens the link and sets a password. This verifies their email address, and the supplier is registered.
5. The supplier can view their profile and update their technical and legal information. The reviewed sign-up keeps its original values.

If the email in a sign-up already belongs to an account, the sign-up is refused, and the person signs in instead.

The `admin` may suspend or reactivate a supplier at their discretion. A `suspended` supplier cannot submit new bids; its existing bids continue.

## Tender lifecycle

A **tender status** changes only through these transitions. Any other change is rejected.

| From → To | Triggered by |
|---|---|
| `draft tender` → `accepted` | `procurement_officer` accepts it and sets the **score weights** and the **minimum technical score** |
| `accepted` → `published` | `procurement_officer` publishes it. The score weights, minimum technical score, and **supplier bid form** are locked from here on. |
| `published` → `closed` | Automatically at the application deadline if at least one bid was received. No new bidders; existing bidders can still replace their technical and financial offers until those deadlines. |
| `published` → `cancelled` | Automatically at the application deadline, if the tender received no bids |
| `closed` → `under_evaluation` | Automatically at the financial deadline |
| `under_evaluation` → `awarded` | Automatically, when the **ranking** is complete and one bid has the highest combined score. If several bids share it, the `procurement_officer` chooses one of them. |
| `under_evaluation` → `cancelled` | Automatically, when a completed evaluation stage leaves no eligible bids |

A `cancelled` tender is final. The `procurement_officer` may copy it into a new tender, which starts at `accepted`:

- The details, score weights, and minimum technical score are copied, and can be edited.
- The deadlines and bids are not copied. The officer sets new deadlines and publishes it as usual.
- The new tender records which tender it was copied from.

## Committee assignments

1. While a tender is `accepted`, `published`, or `closed`, the `procurement_officer` raises its committees and nominates members by name and email.
2. The `admin` approves or rejects each nomination. Rejection ends the process for that nomination. On approval, follow the applicable step below.
3. If the nominee has no account, the `admin` chooses its language. The platform creates the account and emails an **account setup link** in that language. The member sets a password and lands on their assignments.
4. If the nominee already has an account, the approved **committee assignment** is added to it, with no new link.

## Bid submission

1. An `active` `supplier` submits a bid before the application deadline, through the **supplier bid form** with all three **bid parts**. The form includes all required fields and files.
2. Until its own deadline, the owning `supplier` may replace a bid part. Earlier versions are not kept.
   - legal information: the application deadline
   - technical offer: the technical deadline
   - financial offer: the financial deadline
3. After its deadline, a bid part is locked.

## Evaluation and award

Each evaluation sees only the bids that passed the one before it.

Each committee acts through its members' **committee assignments** for that tender.

1. **Legal Evaluation**: the `legal_committee` passes or fails each bid on its legal information.
2. **Technical Evaluation**: the `technical_committee` gives each passed bid a **technical score**. Bids below the **minimum technical score** fail.
3. **Financial Evaluation**: the `financial_committee` reviews each remaining financial offer, gives it a **financial score**, and records its **confirmed total bid price**. Financial offers of failed bids are never opened.
4. The system calculates each eligible bid’s **combined score** and the **ranking**. Bids priced above the **estimated balance** are flagged, not rejected.
5. The `procurement_officer` sees the ranking with supplier names and scores, but not the bid contents.
6. The system awards the tender to the top-ranked bid, and the tender becomes `awarded`. If several bids share the top rank, the `procurement_officer` chooses one of them.

The score weights are never shown to a `guest`, a `supplier`, or any committee. The estimated balance is never shown to a `guest` or a `supplier`.

## After the award

V1 ends at `awarded`. Contracts and delivery are handled outside the platform.

1. The platform uses two templates to prepare one email per bidder: one for the winning supplier, and one for each other bidder.
2. The `procurement_officer` reviews and edits them, then sends them.
3. Bidders who did not win receive no scores and no details about the winning bid.

When a tender is `cancelled`, the platform prepares a cancellation email from a template for every bidder, which the `procurement_officer` reviews and sends.

At any **tender status**, the `procurement_officer` can use **Contact Supplier** on a supplier's profile or bid entry to email the supplier's verified address.
