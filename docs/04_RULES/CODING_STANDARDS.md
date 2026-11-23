# Coding Standards

Status: accepted.

How code is written in `backend/` and `frontend/`: layout, naming, formatting, and the shape of each kind of file. The style comes from the team's earlier project, `b4f-board-final`, adapted where [ADR 0004](../05_ARCHITECTURE/ADR/0004_TECHNOLOGY_STACK.md) or the accepted design differs (see [section 5](#5-where-we-differ-from-b4f-board-final)).

Policies (security, access, response DTOs per audience, performance, audit, test scope) live in the [engineering standards](ENGINEERING_STANDARDS.md). This file links to them and does not restate them ([§6.6](ENGINEERING_STANDARDS.md#66-documentation)). Names follow the [glossary](../GLOSSARY.md).

## 1. Both apps

### 1.1 Tooling

| | Back end | Front end |
|---|---|---|
| TypeScript | `strict: true` | `strict: true` |
| Lint | ESLint with `@typescript-eslint/recommended` and `prettier/recommended` | ESLint with `next/core-web-vitals` and `prettier` |
| Format | Prettier: `singleQuote`, `trailingComma: "all"`, `printWidth: 100` | Same |
| Tests | Jest with `ts-jest` | Vitest with Testing Library and jsdom |

- `npm run lint` and the tests pass before every commit. Reviews do not repeat what the linter or Prettier already enforce.
- `@typescript-eslint/no-explicit-any` is a warning; a new `any` needs a comment saying why. Unused parameters start with `_`.

### 1.2 Names

- Domain names use the glossary terms ([§6.1](ENGINEERING_STANDARDS.md#61-naming-conventions)): `Tender`, `DraftTender`, `BidPart`, `TechnicalEvaluation`.
- Enum values are written exactly as in the [ERD](../05_ARCHITECTURE/ERD.md) and the API: lowercase snake case, such as `under_evaluation` and `legal_committee`.
- A boolean reads as a question: `isLocked`, `meetsMinimum`, `canSubmit`.

### 1.3 Imports

- Order: framework and libraries, then project modules, then relative files. Prettier and ESLint keep the rest consistent.
- Type-only imports use `import type`.
- The front end imports project files through the `@/` alias, never long `../../` paths.

### 1.4 Comments

- A comment explains why, not what.
- When code enforces a documented rule, cite the source and section, so a reader can check it:

  ```ts
  // 404, not 403: never confirm a record exists to someone who cannot see it.
  // See ENGINEERING_STANDARDS.md §2.2.
  ```

- No commented-out code, and no AI attribution.

### 1.5 Configuration

- Each app has a `.env.example` with a comment on every variable. `.env` is never committed ([§2.6](ENGINEERING_STANDARDS.md#26-secrets-management)).
- The back end reads configuration through `@nestjs/config`. The front end reads `process.env` in one module only.

## 2. Back end (`backend/`)

### 2.1 Layout

```text
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/            decorators, filters, interceptors, guards, utils
│   ├── prisma/            PrismaModule, PrismaService
│   └── tenders/           one folder per module (standards §1.1)
│       ├── tenders.module.ts
│       ├── tenders.controller.ts
│       ├── tenders.service.ts
│       ├── tenders.service.spec.ts
│       └── dto/
│           ├── create-draft-tender.dto.ts
│           └── public-tender.dto.ts
└── test/
    └── jest-setup.ts
```

- One folder per module in [standards §1.1](ENGINEERING_STANDARDS.md#11-modular-monolith), named in plural kebab case: `tenders`, `supplier-sign-up`, `committees`, `bids`, `evaluations`.
- Files are kebab case with their kind: `<name>.module.ts`, `.controller.ts`, `.service.ts`, `.dto.ts`, `.guard.ts`, `.decorator.ts`, `.filter.ts`, `.interceptor.ts`, `.util.ts`, `.spec.ts`.
- Classes are PascalCase with their kind: `TendersService`, `TendersController`, `CreateDraftTenderDto`. Response DTOs keep the names in [standards §2.7](ENGINEERING_STANDARDS.md#27-dtos), such as `PublicTender` and `TechnicalBidView`.
- A module exports only the services other modules may call.

### 2.2 Controllers

- A controller method reads the input, calls one service method, and returns its result. No business logic or Prisma calls ([§1.2](ENGINEERING_STANDARDS.md#12-separation-of-concerns)).
- Class decorators: `@ApiTags('<tag from the API contract>')` and the authentication guard. Public endpoints say so explicitly.
- ID parameters use `ParseUUIDPipe`. The current user comes only from the `@CurrentUser()` decorator.
- Route paths and tags match the [API contract](../05_ARCHITECTURE/API_CONTRACT.md#2-endpoint-inventory) exactly. Manual status changes are their own endpoints, such as `POST …/publish`.
- Several controller classes may share one file when they belong to the same module but use different route prefixes.

```ts
@ApiTags('Employee Tenders')
@UseGuards(JwtAuthGuard)
@Controller('employee/tenders')
export class EmployeeTendersController {
  constructor(private readonly tendersService: TendersService) {}

  @Get(':tenderId')
  findOne(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeTender> {
    return this.tendersService.findOwnTender(tenderId, user.id);
  }
}
```

### 2.3 Services

- Inject dependencies as `private readonly`, with short role names: `prisma`, `access`, `audit`.
- Check access first, in the order of [API contract §1.4](../05_ARCHITECTURE/API_CONTRACT.md#14-check-order), before reading or changing anything.
- Load-or-fail helpers are private and named `get<Thing>OrThrow`.
- Operations that must succeed or fail together run in `this.prisma.$transaction(async (tx) => …)` ([§3.2](ENGINEERING_STANDARDS.md#32-database-transactions)). Services called inside a transaction accept it as a last parameter:

  ```ts
  record(input: AuditEventInput, tx: Prisma.TransactionClient | PrismaService = this.prisma)
  ```

- Prisma queries name their fields with `select` or `include`. A service returns a response DTO, never a Prisma entity.
- Throw Nest exceptions carrying the API contract's error code. The global exception filter turns them into the [error envelope](../05_ARCHITECTURE/API_CONTRACT.md#15-error-envelope-and-codes).
- Audit events are written only through the Audit module's service.

### 2.4 DTOs

- Request DTOs use `class-validator` decorators and `@ApiProperty` or `@ApiPropertyOptional`, with an `example` where it helps.
- Optional fields are typed `?` and start with `@IsOptional()`.
- Enums come from `@prisma/client`.
- Filters and pagination use a query DTO, such as `QueryTendersDto`.
- The global `ValidationPipe` uses `whitelist`, `forbidNonWhitelisted`, and `transform`.

### 2.5 Prisma schema

- Models are PascalCase and singular. Fields are camelCase in code and mapped to the ERD's snake case with `@map`. Tables use `@@map("snake_case_plural")`.
- IDs: `String @id @default(uuid()) @db.Uuid`.
- Every relation states `onDelete`, with a comment when the choice is not obvious.
- A comment links each model group to its [ERD](../05_ARCHITECTURE/ERD.md) section. The schema never differs from the ERD without updating the ERD first.
- Every schema change is a named migration (`npx prisma migrate dev --name <change>`). Applied migrations are never edited.

### 2.6 Seed data

- `prisma/seed.ts` can run again at any time and recreates the demo data.
- It refuses to run unless `DATABASE_URL` points at a local database.
- Demo accounts use fictional names and a clearly labelled demo password.

### 2.7 Tests

- Unit tests are `<file>.spec.ts` next to the file. They build the class directly with a mocked `PrismaService`.
- Integration tests are `<name>.integration.spec.ts`. They use the local database, give every fixture a run-unique suffix, and delete what they create in `afterAll`.
- `describe` names the class or behaviour. `it` states the expected result as a sentence: `it('returns 404, not 403, to a committee member of another tender')`.
- A short comment at the top of each suite names the rule it protects.
- What must be tested is in [standards §9](ENGINEERING_STANDARDS.md#9-testing).

## 3. Front end (`frontend/`)

### 3.1 Layout

```text
frontend/src/
├── app/[locale]/
│   ├── (public)/          route groups from standards §12
│   ├── (auth)/
│   ├── (supplier)/
│   └── (staff)/
├── components/
│   ├── ui/                shadcn/ui
│   └── <domain>/          tenders/, bids/, evaluations/ …
├── lib/
│   ├── api/               Orval-generated client and its mutator
│   └── …                  small helpers, camelCase.ts
└── messages/              en.json, ar.json
```

- A component used by one page sits next to that page. A component used by several pages goes in `components/<domain>/`.

### 3.2 Components

- Files are PascalCase and named after their export: `TenderCard.tsx` exports `TenderCard`.
- Use named exports and `function` declarations. Only Next route files (`page`, `layout`, `loading`, `error`, `not-found`) use default exports.
- Type props inline when there are three or fewer, otherwise as `type <Component>Props`.
- `'use client'` is the first line, and only where [§12](ENGINEERING_STANDARDS.md#12-front-end-nextjs) allows it.
- Hooks live in `use<Thing>.ts`.

### 3.3 Data and state

- API calls use only the Orval-generated hooks. Query keys and cache rules follow [API contract §1.2](../05_ARCHITECTURE/API_CONTRACT.md#12-query-cache-and-http-caching).
- State that belongs in a link, such as filters, search, and page number, lives in the URL search parameters.
- Screen-only state uses React state or context.

### 3.4 UI and language

- Use shadcn/ui components and Tailwind classes. Do not add custom `@apply` classes for buttons or inputs.
- Every data view handles loading, empty, and error states.
- No user-facing text is hard-coded; it comes from `messages/en.json` and `messages/ar.json`.
- Use logical Tailwind classes for direction (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`), so Arabic right-to-left layout works without separate styles.

### 3.5 Tests

- Tests are `<Component>.test.tsx` next to the component.
- Find elements by role, label, or text, never by CSS class: `getByRole('button', { name: /publish/i })`.
- Mock the API layer with `vi.mock`, never the component under test.
- A short comment at the top of each suite names the behaviour it protects.

## 4. Git and reviews

Branches, commits, and pull requests follow [GIT_WORKFLOW.md](GIT_WORKFLOW.md) and [standards §10](ENGINEERING_STANDARDS.md#10-git-and-code-review).

## 5. Where we differ from `b4f-board-final`

| `b4f-board-final` | Here | Why |
|---|---|---|
| Bearer token in the `Authorization` header | HttpOnly JWT cookie with CSRF | [ADR 0004](../05_ARCHITECTURE/ADR/0004_TECHNOLOGY_STACK.md), [API contract §1.1](../05_ARCHITECTURE/API_CONTRACT.md#11-session-csrf-refresh) |
| Server Actions and a server-only API client | TanStack Query with the Orval client | ADR 0004 |
| Redux | React state and context | ADR 0004 |
| Services return Prisma entities | Services return response DTOs | [Standards §2.7](ENGINEERING_STANDARDS.md#27-dtos) |
| `{ statusCode, message, error, path, timestamp }` errors | The API contract's error envelope with codes | [API contract §1.5](../05_ARCHITECTURE/API_CONTRACT.md#15-error-envelope-and-codes) |
| `403` for a disallowed role | `404` for anything the user may not see | [Standards §6.3](ENGINEERING_STANDARDS.md#63-error-handling) |
| Upper-case enum values (`IN_PROGRESS`) | The ERD's lower-case values (`under_evaluation`) | The API returns the ERD's values |
| camelCase database columns | snake_case columns through `@map` | [Standards §6.1](ENGINEERING_STANDARDS.md#61-naming-conventions) |
| `@apply` button and input classes | shadcn/ui components | ADR 0004 |
| Partial `strict` options, print width 95 and 100 | `strict: true`, print width 100 in both apps | One setting for the whole team |
| English only | English and Arabic with logical direction classes | [V1 scope](../03_SCOPE/V1_SCOPE.md) |

The mobile app (`mobile/`) gets its own section before S7.
