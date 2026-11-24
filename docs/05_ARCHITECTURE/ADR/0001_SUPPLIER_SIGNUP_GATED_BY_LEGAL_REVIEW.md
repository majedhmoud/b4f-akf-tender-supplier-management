---
status: accepted
---

# Supplier sign-up is gated by legal review

Guests cannot register themselves as suppliers. The `legal_committee` must first accept a guest's legal information and raise the sign-up request. The `admin` then accepts it, and the platform creates the account and emails an **account setup link**; setting a password through it verifies the email address (see **supplier_signup_process** in [WORKFLOWS.md](../../01_PROBLEM/WORKFLOWS.md#supplier_signup_process)). We chose this so that every supplier is legally screened before they can take part in any tender, at the cost of a slower sign-up.
