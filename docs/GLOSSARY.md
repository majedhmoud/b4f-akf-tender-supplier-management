# Tender and Supplier Management

The shared language for the Aga Khan Foundation's tender and supplier management platform. It holds terms and their definitions only. Duties are in the [capability matrix](05_ARCHITECTURE/CAPABILITY_MATRIX.md), and processes are in [WORKFLOWS.md](01_PROBLEM/WORKFLOWS.md).

## Users

**admin**:
The head manager of the AKF.

**legal_committee**:
The committee that reviews suppliers' legal information.

**technical_committee**:
The committee that evaluates technical offers.

**financial_committee**:
The committee that evaluates financial offers.

**procurement_officer**:
The AKF employee who runs tenders from draft to award.

**requester**:
The AKF employee who requests a **tender**.

**supplier**:
A `guest` who has completed the **supplier_signup_process**.

**guest**:
An unregistered visitor.
_Avoid_: visitor, anonymous user

## Tenders

**tender**:
A published request with three deadlines (application, technical, and financial), a category, and other details.
_Avoid_: bidding, RFP

**draft tender**:
A requester's proposal for a **tender**. It has estimated technical requirements and financial requirements based on the project's balance, but no deadlines, suppliers, or committees.
_Avoid_: bid draft

**bid**:
A supplier's application to a **tender**, made of legal information, a technical offer, and a financial offer.
_Avoid_: offer, application

**tender status**:
The stage a **tender** is in: `accepted`, `published`, `closed`, `under_evaluation`, `awarded`, or `cancelled`. Before `accepted`, it is a **draft tender**.

**estimated balance**:
The estimated budget for a **tender**, based on the project's balance.
_Avoid_: budget, ceiling

**bid part**:
One of the three parts of a **bid**: legal information, technical offer, or financial offer. Each has its own deadline.

**bidder code**:
The label, such as "Bidder A", that the `technical_committee` and `financial_committee` see instead of the supplier's identity.

## Evaluations

Each evaluation is named after the user who performs it.

- **Legal Evaluation**: performed by `legal_committee`.
- **Technical Evaluation**: performed by `technical_committee`.
- **Financial Evaluation**: performed by `financial_committee`.

**score weights**:
The share of the **combined score** given to the **technical score** and to the **financial score**, such as 70/30. Set per **tender**.

**minimum technical score**:
The lowest **technical score** a **bid** needs to pass the **Technical Evaluation**. Set per **tender**.

**technical score**:
The score out of 100 that the `technical_committee` gives a **bid**.

**financial score**:
The score out of 100 that the system calculates for a **bid**: the lowest confirmed total bid price divided by this bid's price, times 100.

**combined score**:
A **bid**'s technical score and financial score, combined using the **score weights**.

## Processes

**supplier_signup_process**:
How a `guest` becomes a `supplier`. See [WORKFLOWS.md](01_PROBLEM/WORKFLOWS.md#supplier_signup_process).
