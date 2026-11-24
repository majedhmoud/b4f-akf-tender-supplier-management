# Capability Matrix

Who can do what, based on [GLOSSARY.md](../GLOSSARY.md) and the [API contract](API_CONTRACT.md).

Legend: ✓ allowed · ✗ not allowed. Anything not listed is denied.

Committee columns mean an approved **committee assignment** on that tender. The exception is sign-up review, which the standing `legal_committee` role performs without a tender.

Each cell is about one role. A person may hold several roles, but the tender's requesting `employee`, the `procurement_officer`, and the `admin` never serve on that tender's committees (see [engineering standards §2.2](../04_RULES/ENGINEERING_STANDARDS.md#22-authorization)).

| Capability | guest | supplier | employee | procurement_officer | admin | legal_committee | technical_committee | financial_committee |
|---|---|---|---|---|---|---|---|---|
| Explore published tenders | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Follow their own bids on mobile (status, deadlines and part locks) | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Submit legal information for sign-up | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Accept or reject a supplier's sign-up (sign-up review) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Raise the sign-up request to the admin | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Accept a raised sign-up request | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Create the supplier account and send the account setup link (done by the system, no user) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Complete sign-up as the approved applicant holding the valid setup link | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Suspend or reactivate a supplier | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Edit own technical and legal information | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Create a draft tender | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Edit their own draft tender, while it is a draft | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Accept a draft tender | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Set score weights and minimum technical score | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Upload Terms of Reference and set the supplier bid form | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Publish a tender | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Raise committees, and nominate or withdraw members | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Approve committee members and register their accounts | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Submit a bid (`active` suppliers only) | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Replace their own bid part before its deadline (also while `suspended`) | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Legal Evaluation | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| See and evaluate the technical offer (Technical Evaluation) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| See and evaluate the financial offer (Financial Evaluation) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Rank bids by combined score (done by the system, no user) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| See the ranking (names and scores, no bid contents) | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Award the top-ranked bid (done by the system, no user) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Choose the winner among bids tied at the top rank | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Review and send award and cancellation emails | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Contact Supplier | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Copy a cancelled tender into a new tender | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |

The `legal_committee`, `technical_committee` and `financial_committee` columns of the evaluation rows mean an approved assignment of that type on the tender. The standing `legal_committee` role, used for sign-up review, gives no tender access (ERD, Sealed, blind evaluation).

The mobile supplier session only adds the read capability shown above. Account setup, bid submission and replacement, and access to bid documents remain on the web. The supplier ownership rules apply on both platforms.
