# S7 Supplier Companion

Path: a guest browses published tenders in Expo → opens the tender and its Terms of Reference → signs in with an existing supplier account → opens My bids and tracks the tender status, part deadlines and locks.

## Scope

- Public tender search filters titles from every page returned by T1. Details and signed downloads use T2 and T2d. Countdown clocks use uncached server time. The app supports English, Arabic and right-to-left layout, including a supplier sidebar.
- Both clients use the same NestJS API and PostgreSQL database. Web and mobile use separate session credentials, as defined in [ADR 0007](../05_ARCHITECTURE/ADR/0007_SUPPLIER_MOBILE_SIGN_IN.md) and the [API contract](../05_ARCHITECTURE/API_CONTRACT.md#19-mobile-supplier-sessions-s7).
- My bids is read-only and scoped to the signed-in supplier. Mobile excludes signup, account setup, bid writes, sealed file downloads and staff screens.

## Verification and status

- Implemented in the project snapshot, with separate mobile and web session channels.
- Backend typecheck, targeted lint, build, migration deployment and schema comparison passed. The four affected integration suites passed 25 tests against disposable PostgreSQL and Redis instances. They cover mobile session isolation, refresh reuse, revocation, bid ownership and response fields, plus web auth and API documentation regressions.
- Mobile typecheck, lint and iOS and Android bundle exports passed after the UI refresh. Majed approved the earlier UI. Device-level visual verification of the redesign was not recorded.
- The local demo API was migrated and seeded. Its loopback and LAN addresses returned the same tender IDs to the web and mobile configurations. This does not verify sign-in or downloads on a phone.
- The backend tests cover the access boundary. Device sign-in, restoration, downloads and sign-out were not part of the recorded bundle checks.

See the [README](../../README.md#mobile-expo) for setup.
