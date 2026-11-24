---
status: accepted
---

# Supplier sign-in for the mobile app

## Context

[S7](../../03_SCOPE/V1_SCOPE.md#mobile-app-react-native-s7-supplier-companion) lets suppliers browse published tenders and track their own bids. The existing API authenticates web users with HttpOnly cookies and protects web writes with CSRF tokens. Mobile needs to reuse the same accounts, session rules, and bid ownership checks.

## Decision

- S7 uses the existing NestJS API and PostgreSQL database. It shares the web app's supplier accounts and reuses the existing public tender list, detail, and download endpoints.
- In that same API, use supplier-only `POST` endpoints for sign-in, refresh, and sign-out under `/api/v1/mobile/auth`. Reuse server-side password verification, rate limiting, session expiry, refresh rotation, and revocation. Require an active account with the supplier role and a supplier record, and recheck eligibility on refresh and protected reads. A suspended supplier retains read access to their existing bids while their user account is active.
- Return a short-lived access token and a rotating refresh token in the response body over HTTPS. Keep the access token in memory and store only the refresh token in [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/). Restore the session with one refresh request at a time. On sign-out, revoke the device session when reachable and clear local tokens and private query data immediately. Keep passwords and tokens out of logs and URLs.
- Bind sessions and tokens to the mobile channel. Accept `Authorization: Bearer` only on the explicitly enabled read routes `GET /api/v1/me/bids` and `GET /api/v1/me/bids/:bidId`. Reuse supplier and ownership checks and return only the status, deadlines, and locked-part information needed by S7. Staff routes, bid writes, and sealed file downloads stay web-only.
- Mobile auth routes ignore web cookies and use only the credentials supplied for their own flow. Keep the existing web cookie and CSRF rules intact. Public tender browsing and public Terms of Reference downloads need no sign-in.

## Consequences

The app uses the existing accounts and API without relying on the browser cookie jar or adding an identity provider. The [mobile session contract](../API_CONTRACT.md#19-mobile-supplier-sessions-s7) defines the mobile session channel and read scope. Verify that an expired or revoked session cannot read bids, a supplier cannot read another supplier's bid, and a mobile token cannot access staff routes, bid writes, or sealed downloads.

The migration `20261124120000_mobile_session_channel` gives existing sessions the default `web` channel. Both clients must connect to the same running backend. Local addresses can differ because a phone reaches the development machine over the LAN. See the [S7 checkpoint](../../06_SLICES/S7_SUPPLIER_COMPANION.md#verification-and-status) for verification.
