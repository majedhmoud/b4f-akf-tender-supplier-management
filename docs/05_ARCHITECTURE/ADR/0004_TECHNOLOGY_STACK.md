---
status: accepted
---

# Technology stack

We use tools the team already knows from `b4f-board-final`, plus background jobs and email, which this product needs.

| Area | Choice |
|---|---|
| Back end | NestJS, TypeScript, Prisma, PostgreSQL, Swagger |
| Login | Passport JWT in an httpOnly cookie; bcrypt for passwords |
| Permissions | Manual guards: one access service decides who sees which tender and bid; each committee's queries select only its allowed fields; 404 for anything a user may not see |
| Background jobs | BullMQ + Redis |
| Email | Nodemailer; Mailpit in development |
| Front end | Next.js App Router, Tailwind with some native CSS, shadcn/ui |
| Data fetching | TanStack Query with an Orval-generated client from Swagger; the browser calls the API, protected by CORS and CSRF |
| Screen state | React state and context; no Redux |
| Local services | PostgreSQL, Redis, and Mailpit, installed natively by each member |
| Code quality and tests | ESLint and Prettier in both apps; `class-validator` and `@nestjs/config` in the back end; Jest (back end); Vitest with Testing Library (front end) |

## Sealed-bid acceptance check

A technical reviewer opens a technical offer and signs out. A financial reviewer then signs in using the same browser and opens the same bid. Verify that the technical offer stays hidden throughout the account switch and subsequent navigation, including while new data loads.

## Considered options

- **CASL instead of manual guards:** rejected for setup time. Because of that, the separation between `technical_committee` and `financial_committee` ([ADR 0002](0002_INDEPENDENT_TECHNICAL_AND_FINANCIAL_EVALUATION.md)) depends on the single access service and on tests for each row of the capability matrix.
- **Server Actions with a server-only client:** the `b4f-board-final` pattern, rejected in favour of TanStack Query caching. As a result, the API must handle CORS and CSRF.
- **Redux:** rejected. TanStack Query manages API data, and React state and context cover the current screen-state needs.
- **argon2:** bcrypt kept, because the team already uses it.
