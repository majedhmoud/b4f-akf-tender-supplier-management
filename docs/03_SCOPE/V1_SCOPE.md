# V1 Scope

Status: accepted.

V1 is the path the slices S1–S7 in the [roadmap](../HACKATHON_ROADMAP.md) cover. Terms follow the [glossary](../GLOSSARY.md).

## Web app (Next.js)

| Area | V1 includes |
|---|---|
| Tenders (S1) | Draft tender → accept with scoring → Terms of Reference → publish. Custom fields on the supplier bid form, added before publishing. Public browsing in English and Arabic, with fallback. Copying a cancelled tender. |
| Sign-up (S2) | Guest application → sign-up review → admin acceptance → account setup link. Supplier profile with technical and legal information. Suspending and reactivating suppliers. |
| Committees (S3) | Raising committees, nominating members, admin approval, account setup links for new members, My assignments. |
| Bids (S4) | Submitting all three bid parts together, including answers to the tender's custom fields, replacing each part until its deadline, translated copies of files. |
| Evaluation (S5) | Sealed Legal → Technical → Financial Evaluations, blind review by bidder code. |
| Award (S6) | Automatic ranking and award, procurement officer tie-break, award and cancellation emails, Contact Supplier. |
| Cross-cutting | English and Arabic with right-to-left layout, email in the recipient's language, audit events, Swagger, Postman collection, seed data with demo accounts. |

## Mobile app (React Native, S7): supplier companion

Suppliers often work from their phones. The mobile app helps them notice tenders and follow their bids in time, which widens competition.

| Includes | Users |
|---|---|
| Browsing and searching published tenders in English and Arabic, with right-to-left layout and fallback | `guest`, `supplier` |
| Tender detail with deadline countdowns (server time) and Terms of Reference downloads | `guest`, `supplier` |
| Sign-in and sign-out | `supplier` |
| My bids: each bid's tender status, part deadlines, and which parts are locked | `supplier` |

On the web only: sign-up, bid submission and replacement, and every staff and committee screen. Sealed bid documents are never downloaded to phones.

The web and mobile apps use one NestJS API and one PostgreSQL database. Mobile supplier sessions follow [ADR 0007](../05_ARCHITECTURE/ADR/0007_SUPPLIER_MOBILE_SIGN_IN.md) and the [API contract](../05_ARCHITECTURE/API_CONTRACT.md#19-mobile-supplier-sessions-s7). See the [S7 slice](../06_SLICES/S7_SUPPLIER_COMPANION.md) for implementation and verification status.

## Postponed

| Item | Source | Note |
|---|---|---|
| Supplier ratings on work quality and compliance with terms | [PRODUCT_REQUIREMENTS_V1.md](../01_PROBLEM/PRODUCT_REQUIREMENTS_V1.md) | Postponed by team decision. A later rating can reference a supplier's bid without changing historical bids (see the [ERD](../05_ARCHITECTURE/ERD.md#extension)). |
| Contracts and delivery | [WORKFLOWS.md](../01_PROBLEM/WORKFLOWS.md#after-the-award) | V1 ends at `awarded`; these are handled outside the platform. |
| Manual cancellation | [Tender lifecycle](../01_PROBLEM/WORKFLOWS.md#tender-lifecycle) | V1 supports automatic cancellation only. |
| Password reset | [Engineering standards §2.1](../04_RULES/ENGINEERING_STANDARDS.md#21-authentication) | No password reset flow in V1. |
| Rejection email to applicants | [API contract](../05_ARCHITECTURE/API_CONTRACT.md#5-out-of-scope-for-v1) | Outside the accepted sign-up flow. |
| In-app won/not-won results | [API contract](../05_ARCHITECTURE/API_CONTRACT.md#5-out-of-scope-for-v1) | Suppliers learn their result from the email the `procurement_officer` reviews and sends. |
| Push notifications and deadline reminder emails | — | Not in V1. |
| Managing categories in the app | [ERD](../05_ARCHITECTURE/ERD.md#assumptions) assumption A7 | Categories are a fixed, seeded list. |
| Mobile bid submission, staff screens, and committee screens | This scope | Web only. |
