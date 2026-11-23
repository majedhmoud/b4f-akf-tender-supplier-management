---
status: accepted
---

# Create supplier accounts automatically after admin acceptance

## Context

The original sign-up workflow assigned account creation to the `admin` and verification email delivery to the `procurement_officer`. The team retained the legal screening gate in [ADR 0001](0001_SUPPLIER_SIGNUP_GATED_BY_LEGAL_REVIEW.md) and changed who provisions and activates the account.

## Decision

The standing `legal_committee` role reviews the complete application. Rejection ends sign-up. Acceptance sends the request to the `admin`, who accepts it without editing the reviewed details. This standing role grants no tender access.

On admin acceptance, the platform creates the supplier profile and a pending account, issues an expiring single-use setup token, and prepares the setup email in the applicant’s preferred language. The platform sends the email automatically. Setting a password through the link verifies the address and activates the account.

## Consequences

Legal review and admin acceptance remain human decisions. Account creation and email delivery no longer require a procurement officer handoff. The account stays pending until setup succeeds. The [accepted ERD](../ERD.md#sign-up) defines the transaction boundary and token handling.
