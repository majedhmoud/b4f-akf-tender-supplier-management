---
status: accepted
---

# Technology stack

We use tools the team already knows from `b4f-board-final`, plus background jobs and email, which this product needs.

| Area | Choice |
|---|---|
| Back end | NestJS, TypeScript, Prisma, PostgreSQL, Swagger |
| Login | Shared bcrypt password verification and rate limiting. Web: Passport JWT in an HttpOnly cookie with CSRF. Mobile: supplier-only bearer sessions with device storage ([ADR 0007](0007_SUPPLIER_MOBILE_SIGN_IN.md)). |
| Permissions | Manual guards: one access service decides who sees which tender and bid; each committee's queries select only its allowed fields; 404 for anything a user may not see |
| Background jobs | BullMQ + Redis, through the ioredis client that BullMQ needs |
| Email | Nodemailer; Mailpit in development |
| Front end | Next.js App Router, Tailwind with some native CSS, shadcn/ui |
| Mobile | React Native, Expo Router, typed API requests, Expo SecureStore for the refresh token |
| Data fetching | TanStack Query with an Orval-generated client from Swagger; the browser calls the API, protected by CORS and CSRF |
| Screen state | React state and context; no Redux |
| Local services | PostgreSQL, Redis, and Mailpit, installed natively by each member |
| Code quality and tests | ESLint and Prettier for backend and web; `class-validator` and `@nestjs/config` in the backend; Vitest for backend and web with Testing Library on web; the mobile project has TypeScript, Expo lint and native bundle checks |
| Translations | next-intl in the web app: `/[locale]/` routing, `messages/en.json` and `messages/ar.json`, Arabic plural rules, and date and number formatting |

## Sealed-bid acceptance check

A technical reviewer opens a technical offer and signs out. A financial reviewer then signs in using the same browser and opens the same bid. Verify that the technical offer stays hidden throughout the account switch and subsequent navigation, including while new data loads.

## Considered options

- **CASL instead of manual guards:** rejected for setup time. Because of that, the separation between `technical_committee` and `financial_committee` ([ADR 0002](0002_INDEPENDENT_TECHNICAL_AND_FINANCIAL_EVALUATION.md)) depends on the single access service and on tests for each row of the capability matrix.
- **Server Actions with a server-only client:** the `b4f-board-final` pattern, rejected in favour of TanStack Query caching. As a result, the API must handle CORS and CSRF.
- **Redux:** rejected. TanStack Query manages API data, and React state and context cover the current screen-state needs.
- **argon2:** bcrypt kept, because the team already uses it.
- **Next.js dictionary pattern without a library:** rejected; Arabic plurals and passing text to browser components would be hand-written.
