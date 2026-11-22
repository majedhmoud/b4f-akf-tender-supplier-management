# Tender and Supplier Management

The shared language for the Aga Khan Foundation's tender and supplier management platform. Definitions will be added as the team agrees on them.

## Users

**admin**:
The head manager of the AKF. Approves the committee members raised by the `procurement_officer` and registers their accounts.

**legal_committee**:
Reviews the legal information of all suppliers. Accepts a supplier's sign-up in the **supplier_signup_process**.

**technical_committee**:
Reviews and accepts a supplier's technical offer, independently of and confidentially from the `financial_committee`.

**financial_committee**:
Accepts a supplier's financial offer, independently of and confidentially from the `technical_committee`.

**procurement_officer**:
Accepts a **draft tender** from the `requester`, publishes the **tender**, raises the committees to the `admin`, receives the winning supplier from the committees, and contacts the winning supplier.

**requester**:
Requests a **tender**.

**supplier**:
A `guest` who has verified their email in the **supplier_signup_process**.

**guest**:
An unregistered visitor who can explore available tenders and start the **supplier_signup_process**.

## Tenders

**tender**:
A published request with three deadlines (application, technical, and financial), a category, and other details.

**draft tender**:
A requester's proposal for a **tender**. It has estimated technical requirements and financial requirements based on the project's balance, but no deadlines, suppliers, or committees.

**bid**:
A supplier's application to a **tender**, made of legal information, a technical offer, and a financial offer.

## Evaluations

Each evaluation is named after the user who performs it.

- **Legal Evaluation**: performed by `legal_committee`.
- **Technical Evaluation**: performed by `technical_committee`.
- **Financial Evaluation**: performed by `financial_committee`.

## Processes

**supplier_signup_process**:

1. A `guest` explores the available tenders and fills in a form with their legal information.
2. The `legal_committee` accepts the legal information and raises the supplier's information to the `admin`.
3. The `admin` creates an account for the supplier.
4. The `procurement_officer` sends the supplier an email to verify their email address.
5. After verification, the supplier is registered and can continue filling in their technical information.
