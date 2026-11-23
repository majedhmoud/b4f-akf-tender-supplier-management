# Capability Matrix

Who can do what, based on [GLOSSARY.md](../GLOSSARY.md).

Legend: ✓ allowed · ✗ not allowed · blank = not decided yet

Committee columns mean an approved **committee assignment** on that tender. The exception is sign-up review, which the standing `legal_committee` role performs without a tender.

| Capability | guest | supplier | requester | procurement_officer | admin | legal_committee | technical_committee | financial_committee |
|---|---|---|---|---|---|---|---|---|
| Explore available tenders | ✓ | | | | | | | |
| Submit legal information for sign-up | ✓ | | | | | | | |
| Accept or reject a supplier's sign-up (sign-up review) | | | | | | ✓ | | |
| Raise the sign-up request to the admin | | | | | | ✓ | | |
| Accept a raised sign-up request | | | | | ✓ | | | |
| Create the supplier account and send the account setup link (done by the system, no user) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Complete sign-up as the approved applicant holding the valid setup link | ✓ | | | | | | | |
| Suspend or reactivate a supplier | | | | | ✓ | | | |
| Fill in technical information | | ✓ | | | | | | |
| Create a draft tender | | | ✓ | | | | | |
| Accept a draft tender | | | | ✓ | | | | |
| Set score weights and minimum technical score | | | | ✓ | | | | |
| Publish a tender | | | | ✓ | | | | |
| Raise committees | | | | ✓ | | | | |
| Approve committee members and register their accounts | | | | | ✓ | | | |
| Submit a bid (`active` suppliers only) | | ✓ | | | | | | |
| Legal Evaluation | | | | | | ✓ | | |
| See and evaluate the technical offer (Technical Evaluation) | | | | | | | ✓ | ✗ |
| See and evaluate the financial offer (Financial Evaluation) | | | | | | | ✗ | ✓ |
| Rank bids by combined score (done by the system, no user) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| See the ranking (names and scores, no bid contents) | | | | ✓ | | | ✗ | ✗ |
| Award the top-ranked bid (done by the system, no user) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Choose the winner among bids tied at the top rank | | | | ✓ | | | | |
| Review and send award and cancellation emails | | | | ✓ | | | | |
| Contact Supplier | | | | ✓ | | | | |
| Copy a cancelled tender into a new tender | | | | ✓ | | | | |
