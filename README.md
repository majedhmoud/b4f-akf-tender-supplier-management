# Tender and Supplier Management Platform (AKF)

A web and mobile platform for the Aga Khan Foundation's procurement department. It publishes tenders, receives sealed bids, and keeps the legal, technical, and financial evaluations separate. Built by Team2 for the B4F hackathon.

## Team members

| Name | Role | GitHub |
|---|---|---|
| Majed Hmoud | Backend and documentation | `majedhmoud` |
| Ali Al Hamwi | Backend | `ali2alhmwi` |
| Yazan Shartooh | Frontend | `yazan-shartooh` |
| Adham Al Basha | Frontend | `adhamalbasha-7` |
| Maya Al Hamwi | Mobile | `Ma7yaa` |

Each member's main contribution is in the Project Brief in [docs/HAND_IN/](docs/HAND_IN/).

## Main features and tech stack

- Features: the [V1 scope](docs/03_SCOPE/V1_SCOPE.md) lists what ships on the web and on mobile, and what is postponed.
- Tech stack: NestJS, Prisma and PostgreSQL; Next.js; React Native with Expo; Redis with BullMQ; Nodemailer with Mailpit locally ([ADR 0004](docs/05_ARCHITECTURE/ADR/0004_TECHNOLOGY_STACK.md)).

## Repository map

| Path | Contents |
|---|---|
| `docs/` | Requirements, design, decisions, team reviews and hand-in files |
| `backend/` | NestJS API, Prisma schema, migrations and seed |
| `frontend/` | Next.js web app |
| `mobile/` | Expo supplier companion app |

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
- [Supplier companion (S7)](docs/06_SLICES/S7_SUPPLIER_COMPANION.md)
- [Responsive web design](docs/05_ARCHITECTURE/ADR/0008_RESPONSIVE_ACCESSIBLE_WEB_PATTERNS.md)
- [Hand-in documents in English and Arabic](docs/HAND_IN/)

## How to run

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
cp .env.example .env    # set DATABASE_URL and the four secrets described in the example
npm install             # also generates the Prisma client
npx prisma migrate dev  # creates the tables
npm run seed            # loads the demo accounts and tenders below
npm run start:dev
```

Check it at http://localhost:4000/api/v1/health. Swagger is at http://localhost:4000/api/docs.

### Demo accounts

`npm run seed` creates the fictional accounts below and seven tender fixtures: a draft, an accepted tender, two published tenders (one Arabic only), a cancelled tender, a tender ready for sealed evaluation, and an evaluated tender awaiting a tie break. Wadi Supplies is the pending-setup fixture. Open Mailpit to inspect its setup email. Rerunning the seed resets demo data and is limited to a local database.

| Role | Email | Password |
|---|---|---|
| `employee` | `employee@akf-demo.test` | `AKF-demo-2026` |
| `procurement_officer` | `officer@akf-demo.test` | `AKF-demo-2026` |
| `legal_committee` (sign-up review only) | `legal@akf-demo.test` | `AKF-demo-2026` |
| `admin` | `admin@akf-demo.test` | `AKF-demo-2026` |
| Committee member (no account role; approved technical assignment) | `member@akf-demo.test` | `AKF-demo-2026` |
| Committee member (approved legal assignment) | `legal-member@akf-demo.test` | `AKF-demo-2026` |
| Committee member (approved financial assignment) | `finance-member@akf-demo.test` | `AKF-demo-2026` |
| `supplier` (Cedar Supplies) | `supplier@cedar.demo.test` | `AKF-demo-2026` |
| `supplier` (Rafid Works) | `bids@rafid.demo.test` | `AKF-demo-2026` |

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

Open the tender list at http://localhost:3000/en/tenders. Arabic is at `/ar/tenders`. Set `NEXT_PUBLIC_API_URL` in the web app to the same backend instance the mobile app uses. If you change the web port, set the backend's `WEB_ORIGIN` to match and restart it.

### Mobile (Expo)

Start the existing backend first. From the repository root:

```bash
cd mobile
npm ci
cp .env.example .env
npm start
```

Set `EXPO_PUBLIC_API_BASE_URL` to the backend origin without the `/api/v1` suffix. Use `http://localhost:4000` for the iOS simulator, `http://10.0.2.2:4000` for the standard Android emulator, or the development machine's reachable LAN address on a phone. Substitute the chosen backend port when it differs. These addresses should reach one NestJS API backed by one PostgreSQL database. Restart Expo after changing the setting. Use a compatible Expo Go or development build.

Guests can browse and search tenders, view server-time countdowns, and open Terms of Reference. Open the menu and choose **Sign in** to sign in as a supplier; after sign-in, the same menu item opens **My bids**, which shows tender status, deadlines and locked parts. Supplier sign-in requires the current backend with the S7 migration applied. Production mobile sessions require an HTTPS API origin. For local checks, use `npm run typecheck` and `npm run lint` in `mobile/`.

## Backend API Overview

Implemented endpoints use `/api/v1`. [Swagger](http://localhost:4000/api/docs) describes DTOs and errors. The [Postman v2.1 collection](docs/postman/b4f-akf-tender-supplier-management.postman_collection.json) includes runnable requests for S1–S7 API operations.

| Area (Postman folder) | Main endpoints |
|---|---|
| System | `GET /health` |
| Auth | `GET /auth/csrf`, `POST /auth/sign-in`, `GET /auth/session`, `POST /auth/refresh`, `POST /auth/sign-out`, `PATCH /me` |
| Mobile Auth | `POST /mobile/auth/sign-in`, `POST /mobile/auth/refresh`, `POST /mobile/auth/sign-out` |
| Employee Tenders | `POST/GET /employee/tenders`, `GET/PATCH /employee/tenders/:tenderId`, `GET …/documents/:docId/download` |
| Tender Management | `GET /manage/tenders`, `GET/PATCH /manage/tenders/:tenderId`, `POST …/accept`, `POST …/documents`, `DELETE …/documents/:docId`, `GET …/documents/:docId/download`, `POST …/publish`, `POST …/copy`, `GET/PUT …/bid-form` |
| Public Tenders | `GET /tenders`, `GET /tenders/:tenderId`, `GET …/documents/:docId/download` |
| Reference | `GET /reference/tender-categories`, `GET /reference/forms/supplier-application` |
| Sign-up | `POST /supplier-applications`, `GET /signup-reviews`, `GET /supplier-applications/:applicationId`, `GET …/documents/:docId/download`, `POST …/review`, `GET /signup-requests`, `GET /signup-requests/:applicationId`, `POST …/accept` |
| Account Setup | `POST /account-setup/verify`, `POST /account-setup/complete`, `POST /account-setup/resend` |
| Suppliers | `GET/PUT /me/supplier-profile`, `POST …/documents`, `GET …/documents/:docId/download`, `GET /admin/suppliers`, `POST /admin/suppliers/:supplierId/suspend`, `POST …/reactivate` |
| Committees | `GET/POST /manage/tenders/:tenderId/committees`, `POST …/committees/:type/nominations`, `DELETE /manage/nominations/:nominationId`, `GET /admin/committee-nominations`, `POST …/:nominationId/approve`, `POST …/reject`, `GET /me/assignments` |
| Bids | `GET /tenders/:tenderId/bid-form`, `POST /tenders/:tenderId/bids`, `GET /me/bids`, `GET /me/bids/:bidId`, `PUT …/parts/:partType`, `GET …/documents/:docId/download` |
| Evaluation | Legal, technical and financial queue, detail, download and submit operations ([L, X and F](docs/05_ARCHITECTURE/API_CONTRACT.md#evaluation-separate-dtos-absent-fields-are-never-sent)) |
| Award | `GET /manage/tenders/:tenderId/award-status`, `GET …/ranking`, `POST …/award` |
| Emails | `GET /manage/tenders/:tenderId/emails`, `POST …/emails/send`, `GET/PATCH /manage/emails/:emailId`, `POST …/send` |
| Files | Follow the signed URL returned by a document-download operation; never construct it. |

For web requests, enable the cookie jar and set `baseUrl`, `email`, `password`, and `language` locally. A pre-request script obtains CSRF before web writes. For mobile requests, use the Mobile Auth folder and a supplier account. Use its bearer access token only on the two mobile bid reads. Do not export live credentials, cookies, tokens, or signed URLs.

Use requests individually: employee sign-in → create/edit draft → sign out → officer sign-in → read/accept → upload Terms of Reference and save bid form → read current revision → set future UTC deadlines → publish → public detail/download. Select a local upload file in Postman. Removal and copying are separate, state-changing actions; do not run every request blindly. The collection description explains variables and chaining. API tests verify behavior; the collection has not been executed in Postman during this verification.

S2 covers sign-up through U7, account setup S1–S3, supplier profile editing (P1–P2) with certificate replacement, and the admin supplier directory with suspend and reactivate (P4–P5). Use the `legal` and `admin` demo accounts for the review queues. After U7, open the setup email in Mailpit and copy the token after `#token=` into `setupToken`. For guest submission, sign out first, select both certificate files, and retain `applicationKey` for retries. Clear that key only for a deliberately new or changed submission.

### Checks

| Command | Back end | Front end |
|---|---|---|
| `npm run lint` | ESLint | ESLint |
| `npm test` | Unit tests (Vitest) | Component tests (Vitest) |
| `npm run test:e2e` | API tests against the local database | — |
| `npm run build` | Production build | Production build, with type checks |
| `npm run seed` | Resets the demo accounts and tenders | — |
| `npm run api:generate` | — | Regenerates the API client from Swagger; the back end must be running |

## Web routes to know

- Account view: `/en/profile` or `/ar/profile`.
- Setup links open `/[locale]/account-setup#token=…`. The page reads the token from the fragment into memory. Do not share or record live setup tokens.
- Suppliers go to `/profile` after setup; committee members go to `/my-assignments`.

## Known limitations and demo status

- Agreed but not shipped in V1: Contact Supplier, supplier technical documents and translated copies of bid files. See [V1 scope](docs/03_SCOPE/V1_SCOPE.md#postponed).
- No hosted demo URL or distributable mobile build (APK) is recorded. Use the local setup above and the Expo development link shown by Metro.
- What was and was not verified is recorded in the [closeout checkpoint](docs/HACKATHON_ROADMAP.md#closeout-checkpoint--november-24-2026). It includes no mobile device walkthrough and no Postman runtime run.
