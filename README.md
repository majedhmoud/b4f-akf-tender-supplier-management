# Tender and Supplier Management Platform (AKF)

A web and mobile platform for the Aga Khan Foundation's procurement department. It publishes tenders, receives sealed bids, and keeps the legal, technical, and financial evaluations separate. Built by Team2 for the B4F hackathon.

## Repository map

| Path | Contents |
|---|---|
| `docs/` | Requirements, design, and decisions |
| `backend/` | Back end (added in P2) |
| `frontend/` | Front end (added in P2) |
| `mobile/` | Mobile app (added in P2) |

## Start here

- [Submission requirements](docs/01_PROBLEM/SUBMISSION_REQUIREMENTS.md)
- [Product requirements](docs/01_PROBLEM/PRODUCT_REQUIREMENTS_V1.md)
- [Glossary](docs/GLOSSARY.md): the terms we use
- [Workflows](docs/01_PROBLEM/WORKFLOWS.md)
- [V1 scope](docs/03_SCOPE/V1_SCOPE.md): what V1 includes and postpones
- [Hackathon roadmap](docs/HACKATHON_ROADMAP.md): phases and slices
- [Team plan](docs/TEAM_PLAN.md): how we work
- [Capability matrix](docs/05_ARCHITECTURE/CAPABILITY_MATRIX.md): who can do what
- [ERD](docs/05_ARCHITECTURE/ERD.md): the data model
- [API contract](docs/05_ARCHITECTURE/API_CONTRACT.md): endpoints for the web and mobile apps
- [Architecture decisions](docs/05_ARCHITECTURE/ADR/)
- [Git workflow](docs/04_RULES/GIT_WORKFLOW.md)

## How to run

The README is completed with every required section in P3 (see [Submission requirements](docs/01_PROBLEM/SUBMISSION_REQUIREMENTS.md#readme)).

### Requirements

- Node.js 24 or later, and npm.
- PostgreSQL, installed natively ([ADR 0004](docs/05_ARCHITECTURE/ADR/0004_TECHNOLOGY_STACK.md)). On macOS: `brew install postgresql@18`, then `brew services start postgresql@18`.
- Redis and Mailpit, installed natively, for automatic emails. On macOS: `brew install redis mailpit`, then `brew services start redis` and `brew services start mailpit`. Mailpit catches every email locally; read them at http://localhost:8025.

### Database

```bash
createdb akf_tender
```

### Back end (http://localhost:4000)

```bash
cd backend
cp .env.example .env    # set DATABASE_URL and the three secrets, as its comments explain
npm install             # also generates the Prisma client
npx prisma migrate dev  # creates the tables
npm run seed            # loads the demo accounts and tenders below
npm run start:dev
```

Check it at http://localhost:4000/api/v1/health. Swagger is at http://localhost:4000/api/docs.

### Demo accounts

`npm run seed` creates these accounts, five sample tenders (a draft, an accepted one, two published ones with one in Arabic only, and a cancelled one), and five supplier sign-up applications (one waiting for legal review, one raised to the admin, one rejected, Wadi Supplies accepted with setup pending, and Cedar Supplies accepted with an active demo account). With the back end running, that supplier's setup email arrives in Mailpit within a minute. Every name is fictional. Run it again at any time to reset the demo data; it refuses to run against a database that is not on your machine.

| Role | Email | Password |
|---|---|---|
| `employee` | `employee@akf-demo.test` | `AKF-demo-2026` |
| `procurement_officer` | `officer@akf-demo.test` | `AKF-demo-2026` |
| `legal_committee` (sign-up review only) | `legal@akf-demo.test` | `AKF-demo-2026` |
| `admin` | `admin@akf-demo.test` | `AKF-demo-2026` |
| Committee member (no account role; approved technical assignment) | `member@akf-demo.test` | `AKF-demo-2026` |
| `supplier` (Cedar Supplies, after loading the updated seed) | `supplier@cedar.demo.test` | `AKF-demo-2026` |

The password is for this demo only. Never reuse it anywhere real.

The S3 seed raises legal, technical and financial committees on each accepted/published demo tender. `member@akf-demo.test` has one approved technical assignment on the first published tender. `nominee@akf-demo.test` has no account yet and waits for admin approval on the accepted tender's legal committee. Rerunning the seed removes these demo assignments/accounts and their associated setup emails/tokens before recreating the fixtures; do not use demo accounts for work you need to retain.

S3 manual walkthrough:

1. As the officer, open an accepted/published demo tender and nominate another fictional `.test` address. Those committees are already raised; to demonstrate raising one, first accept a new draft tender.
2. As the admin, open Committee nominations, approve `nominee@akf-demo.test` and choose its account language.
3. Open its email in Mailpit at http://localhost:8025 and follow the setup link. Set a password of at least 12 characters; the new member should land on My assignments.
4. Alternatively, sign in as `member@akf-demo.test` to view an already-approved assignment. A standing legal reviewer without an approved tender assignment should have an empty assignment list.

These are manual demonstration steps, not a claim that the flow has been tested.


### Front end (http://localhost:3000)

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. It redirects to `/en`; Arabic is at `/ar`. The page shows whether the API and the database are up.

## Backend API Overview

Implemented endpoints use `/api/v1`. [Swagger](http://localhost:4000/api/docs) describes DTOs and errors; the [Postman v2.1 collection](docs/postman/b4f-akf-tender-supplier-management.postman_collection.json) includes the implemented S1 and S2 sign-up and account setup operations with runnable request examples.

| Area (Postman folder) | Main endpoints |
|---|---|
| System | `GET /health` |
| Auth | `GET /auth/csrf`, `POST /auth/sign-in`, `GET /auth/session`, `POST /auth/refresh`, `POST /auth/sign-out`, `PATCH /me` |
| Employee Tenders | `POST/GET /employee/tenders`, `GET/PATCH /employee/tenders/:tenderId`, `GET …/documents/:docId/download` |
| Tender Management | `GET /manage/tenders`, `GET/PATCH /manage/tenders/:tenderId`, `POST …/accept`, `POST …/documents`, `DELETE …/documents/:docId`, `GET …/documents/:docId/download`, `POST …/publish`, `POST …/copy`, `GET/PUT …/bid-form` |
| Public Tenders | `GET /tenders`, `GET /tenders/:tenderId`, `GET …/documents/:docId/download` |
| Reference | `GET /reference/tender-categories`, `GET /reference/forms/supplier-application` |
| Sign-up | `POST /supplier-applications`, `GET /signup-reviews`, `GET /supplier-applications/:applicationId`, `GET …/documents/:docId/download`, `POST …/review`, `GET /signup-requests`, `GET /signup-requests/:applicationId`, `POST …/accept` |
| Account Setup | `POST /account-setup/verify`, `POST /account-setup/complete`, `POST /account-setup/resend` |
| Suppliers | `GET/PUT /me/supplier-profile`, `POST …/documents`, `GET …/documents/:docId/download`, `GET /admin/suppliers`, `POST /admin/suppliers/:supplierId/suspend`, `POST …/reactivate` |
| Committees | `GET/POST /manage/tenders/:tenderId/committees`, `POST …/committees/:type/nominations`, `DELETE /manage/nominations/:nominationId`, `GET /admin/committee-nominations`, `POST …/:nominationId/approve`, `POST …/reject`, `GET /me/assignments` |
| Bids | `GET /tenders/:tenderId/bid-form`, `POST /tenders/:tenderId/bids`, `GET /me/bids`, `GET /me/bids/:bidId`, `PUT …/parts/:partType`, `GET …/documents/:docId/download` |
| Files | Follow the signed URL returned by a document-download operation; never construct it. |

Import the collection with the cookie jar enabled. Set `baseUrl`, `email`, and `password` locally using the demo accounts above; set `language` to `en` or `ar`. No bearer token is needed. A pre-request script obtains CSRF before each write. Do not export live credentials, cookies, tokens, or signed URLs.

Use requests individually: employee sign-in → create/edit draft → sign out → officer sign-in → read/accept → upload Terms of Reference and save bid form → read current revision → set future UTC deadlines → publish → public detail/download. Select a local upload file in Postman. Removal and copying are separate, state-changing actions; do not run every request blindly. The collection description explains variables and chaining. API tests verify behavior; the collection has not been executed in Postman during this verification.

S2 sign-up APIs are available through U7 and account setup S1–S3; supplier profile editing (P1–P2) and the admin supplier directory with suspend and reactivate (P4–P5) are available, and suppliers can replace their sign-up certificates on their profile; technical documents are not implemented yet. Use the `legal` and `admin` demo accounts for the review queues. After U7, open the setup email in Mailpit and copy the token after `#token=` into `setupToken`. For guest submission, sign out first, select both certificate files, and retain `applicationKey` for retries. Clear that key only for a deliberately new or changed submission.

### Checks

| Command | Back end | Front end |
|---|---|---|
| `npm run lint` | ESLint | ESLint |
| `npm test` | Unit tests (Vitest) | Component tests (Vitest) |
| `npm run test:e2e` | API tests against the local database | — |
| `npm run build` | Production build | Production build, with type checks |
| `npm run seed` | Resets the demo accounts and tenders | — |
| `npm run api:generate` | — | Regenerates the API client from Swagger; the back end must be running |

## Current web implementation

- Role-aware navigation and account view: `/en/profile` or `/ar/profile`.
- Guest supplier application, legal review queue, admin raised queue and admin-only acceptance are implemented. Acceptance reports the email as sending; local setup emails arrive in Mailpit.
- Setup links open `/[locale]/account-setup#token=…`. The page reads the fragment into memory, verifies it and handles password setup, expiry, resend and used/invalid links. Do not share or record live setup tokens.
- Current setup destinations: suppliers go to `/profile`; committee members go to the `/my-assignments` placeholder. Supplier technical documents remain pending.
- See the [roadmap](docs/HACKATHON_ROADMAP.md#current-implementation-checkpoint--november-24-2026) and [S2 checkpoint](docs/06_SLICES/S2_SUPPLIER_SIGNUP.md#current-web-checkpoint--november-24-2026) for implementation and verification limits. Earlier test/build results predate the latest setup/profile changes. Further test creation and execution are paused; these changes are not marked verified or accepted as a complete slice.
