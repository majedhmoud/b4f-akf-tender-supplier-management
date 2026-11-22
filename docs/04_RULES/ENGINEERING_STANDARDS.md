# Engineering Standards

Status: accepted.

These standards cover security, performance, scalability, maintainability, and code quality. Every team member follows them when designing, implementing, reviewing, and testing features. All terms follow the [glossary](../GLOSSARY.md), and duties follow the [capability matrix](../05_ARCHITECTURE/CAPABILITY_MATRIX.md).

## 1. Architecture and design principles

### 1.1 Modular monolith

- Follow a modular monolith architecture.
- Organize the back end around business domains, not technical layers alone.
- Give each module one clearly defined responsibility.
- A module must not directly access another module's internal implementation.
- Modules communicate only through well-defined public interfaces or application services.
- Avoid circular dependencies between modules.
- Do not introduce microservices without a documented business or technical justification.

Modules follow the V1 slices:

| Module | Slices |
|---|---|
| Authentication and authorization | All |
| Accounts | S2, S3 |
| Supplier sign-up | S2 |
| Tenders | S1 |
| Committees | S3 |
| Bids | S4 |
| Evaluations | S5 |
| Award | S6 |
| Notifications | S2, S6 |
| Audit | All |

Add a module only when the V1 scope or a later scope includes it.

### 1.2 Separation of concerns

- Controllers handle HTTP requests and responses.
- Services contain application and business logic.
- Repositories or data-access services handle database operations where the abstraction is justified.
- DTOs define and validate incoming API data, and shape outgoing responses (see section 2.7).
- Entities and database models represent persistence structures.
- External integrations sit behind dedicated services or adapters.

Controllers must not contain complex business logic or direct database workflows.

### 1.3 SOLID principles

Apply SOLID where it improves maintainability:

- Single Responsibility Principle.
- Open/Closed Principle.
- Liskov Substitution Principle.
- Interface Segregation Principle.
- Dependency Inversion Principle.

Avoid unnecessary abstractions and premature generalization.

## 2. Security standards

Security is a critical requirement because the platform handles confidential supplier information, legal documents, technical offers, and financial offers.

### 2.1 Authentication

- All protected endpoints require authentication.
- Never store passwords in plain text.
- Use Argon2id or an appropriately configured bcrypt implementation for password hashing.
- Never return password hashes or authentication secrets in API responses.
- Use short-lived access tokens and a secure refresh-token strategy where applicable.
- Protect refresh tokens against theft and replay.
- Check account status during authentication.
- Email verification uses expiring, single-use tokens.
- Password reset tokens are single-use and expire after a limited period.
- Never send passwords by email.

### 2.2 Authorization

- Follow the principle of least privilege.
- Implement role-based access control, with a role for each user in the glossary.
- Add resource-level authorization checks.
- Never trust role information or permissions supplied by the front end.
- Enforce authorization on the back end for every protected operation.
- Deny access by default when permissions are missing or unclear.
- Keep each user's permissions separate: `guest`, `supplier`, `requester`, `procurement_officer`, `admin`, `legal_committee`, `technical_committee`, and `financial_committee`.

Critical rules:

- Published tenders are public. `guest` and `supplier` may browse them.
- A `supplier` accesses only their own sign-up information and their own bids.
- The `technical_committee` never sees financial information. There are no exceptions.
- The `financial_committee` never sees the technical offer and gains no access to unrelated evaluations.
- The `legal_committee` accesses only the information its Legal Evaluation needs.
- Committee members access only the tenders and evaluations they are assigned to.
- Evaluation is blind: the `technical_committee` and `financial_committee` see a **bidder code**, never the supplier's identity. Only the `legal_committee` and, after the award, the `procurement_officer` see who the supplier is.
- `admin`, `requester`, and `procurement_officer` never see bid contents. The `procurement_officer` receives only the winning supplier.
- One person cannot serve on both the `technical_committee` and the `financial_committee` for the same tender.
- The tender's `requester` cannot serve on any of that tender's committees.
- The access service enforces the last two rules when committee members are approved.

Hiding buttons, pages, or routes in Next.js is never a security mechanism.

### 2.3 Input validation

- Validate all incoming data on the back end.
- Use DTOs and a centralized validation strategy.
- Reject unexpected fields where appropriate.
- Validate data types, formats, lengths, ranges, and required fields.
- Never trust front-end validation alone.
- Normalize and sanitize data where necessary.
- Use parameterized database queries through Prisma.
- Never build SQL queries by unsafe string concatenation.
- Protect against XSS, SQL injection, CSRF, and other relevant web vulnerabilities.

### 2.4 Rate limiting

Apply rate limiting to prevent abuse and resource exhaustion.

Suggested initial policies:

| Endpoint category | Suggested limit |
|---|---|
| Login | 5 attempts / minute / IP, with additional account-based controls |
| Password reset | 3 requests / hour / account |
| Email verification | 5 requests / hour / account |
| Public tender browsing | 60 requests / minute / IP |
| Authenticated API | 120 requests / minute / user |
| File upload | 10 requests / minute / user |

These are starting values, not universal limits. Adjust them based on load testing, endpoint cost, and operational requirements.

- Apply stricter limits to authentication and sensitive endpoints.
- Use both IP-based and account-based controls where appropriate.
- Do not rely only on IP addresses, because several legitimate users may share an IP.
- Return HTTP 429 when the limit is exceeded, with appropriate `Retry-After` information.
- Use Redis-backed distributed rate limiting when several back-end instances are deployed.
- Do not apply identical limits to every endpoint.

### 2.5 File upload security

- Never store confidential files in publicly accessible directories.
- Store files in private object storage.
- Validate file size, extension, MIME type, and actual file content.
- Generate storage keys on the server. Never trust user-provided file paths.
- Rename uploaded files using generated identifiers.
- Reject executable and unsupported file types.
- Scan uploaded files for malware where the infrastructure permits.
- Use private, short-lived signed URLs, and only after authorization checks.
- Never expose permanent public links to confidential bids.
- Restrict file downloads according to user permissions.
- Keep financial offer and technical offer documents protected from unauthorized access.

### 2.6 Secrets management

- Never commit API keys, database passwords, JWT secrets, or storage credentials.
- Use environment variables or a dedicated secrets manager.
- Keep a `.env.example` without real credentials in each of `backend/`, `frontend/`, and `mobile/`.
- Rotate exposed secrets immediately.
- Never log passwords, tokens, private keys, or confidential bid contents.
- Exception: the demo accounts' passwords are listed in the README and created by the seed script, as the submission requirements ask. They are not secrets, work only with demo data, and are never reused elsewhere.

### 2.7 DTOs

**Request DTOs:**

- Ownership, role, and status always come from the server, never from the request body:
  - The `supplier` of a bid, the committee member of an evaluation, and the `requester` of a draft tender come from the JWT.
  - A tender status changes only through an explicit action, for example `POST /api/v1/tenders/:id/publish`.
- A draft tender DTO rejects deadlines, suppliers, and committees.
- A publish DTO requires the three deadlines, in the order application → technical → financial, all in the future, and a category.
- A sign-up DTO accepts legal information only, with no role, account, or password fields.
- A bid part DTO is accepted only before that part's deadline, measured by server time.
- An evaluation DTO is accepted once per committee per bid. It cannot be changed after it is submitted.

**Response DTOs:** define one response DTO per audience. Never send one DTO and trim it with conditions.

| Response DTO | Shows | Never shows |
|---|---|---|
| `PublicTender` (`guest`, `supplier`) | The published tender's details and deadlines | Estimated financial requirements, the project's balance, committees |
| `SupplierBid` | The supplier's own full bid | Other suppliers' bids, evaluations |
| `LegalBidView` | Legal information | Technical offer, financial offer |
| `TechnicalBidView` | Technical offer, **bidder code** | Financial offer, supplier identity |
| `FinancialBidView` | Financial offer, **bidder code** | Technical offer, supplier identity |

## 3. Database and data integrity

### 3.1 Database design

- Use PostgreSQL as the primary relational database.
- Use UUIDs or another documented identifier strategy consistently.
- Define foreign keys for relational integrity.
- Add unique constraints for business identifiers that must be unique.
- Use NOT NULL constraints for mandatory data.
- Define indexes based on query patterns.
- Do not store duplicated information without a documented reason.
- Use appropriate database types rather than storing everything as strings.
- Define explicit relationships between business entities.

### 3.2 Database transactions

Use transactions whenever several database operations must succeed or fail together. Examples:

- Submitting a bid part and its document records.
- Submitting an evaluation and updating its submission status.
- Accepting a supplier's sign-up and recording the audit event.
- Awarding a tender and updating its **tender status**.

Never assume that several Prisma queries run in one transaction automatically. Use Prisma transactions when atomicity is required.

### 3.3 Data integrity

- Enforce critical business rules on the back end and, where appropriate, at database level.
- Do not rely only on front-end validation.
- Prevent duplicate submissions using unique constraints and idempotency mechanisms. A `supplier` has at most one bid per tender.
- Reject any tender status change that is not in the [tender lifecycle](../01_PROBLEM/WORKFLOWS.md#tender-lifecycle).
- Use optimistic concurrency control or appropriate locking for operations open to concurrent updates.
- Only the owning `supplier` may replace a bid part, and only before that part's deadline. After the deadline the part is locked. Earlier versions are not kept.
- Never change a submitted evaluation.
- Keep the audit events required for auditability.

### 3.4 Soft deletes

- Do not use soft deletion automatically for every table.
- Define deletion policies based on business and legal requirements.
- Preserve financial, procurement, and audit records when required.
- Use explicit archival or retention policies where appropriate.
- Never let soft deletion bypass authorization or uniqueness constraints.

## 4. Performance

Consider performance during design, not only after the application becomes slow.

### 4.1 Pagination

Never return unbounded collections from API endpoints. All collection endpoints support pagination.

- Default page size: 20.
- Maximum page size: 100.
- Validate page and limit parameters.
- Return pagination metadata.

Example request: `GET /api/v1/tenders?page=1&limit=20`

Example response:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
}
```

Use offset pagination for ordinary administrative tables. Use cursor-based pagination for large datasets, high-volume feeds, or datasets where offset pagination becomes inefficient. Never allow clients to request unlimited records.

### 4.2 N+1 query prevention

Avoid the N+1 query problem: fetching 100 tenders and then running one more query per tender for its related records makes 101 queries.

- Use Prisma `include` or `select` appropriately.
- Fetch related records in batches.
- Avoid queries inside loops.
- Select only the fields the current operation needs.
- Monitor query counts in important workflows.
- Review query performance when implementing list endpoints.

Do not blindly include every relationship. Excessive joins and large nested responses also harm performance.

### 4.3 Database indexing

Add indexes for frequently queried fields. Candidates:

- Tender status.
- Tender publication date.
- Tender deadlines.
- Supplier registration number.
- Supplier status.
- Bid `tender_id` and `supplier_id`.
- Evaluation `bid_id` and committee member ID.
- Audit event timestamp.

Use composite indexes when queries often filter by several fields. Base index decisions on actual query patterns. Indexes speed up reads but add write and storage overhead.

### 4.4 Avoid over-fetching

- Use Prisma `select` to retrieve only required fields.
- Do not return entire database records by default.
- Do not expose internal fields in API responses.
- Do not return confidential information the current user does not need.
- Use the response DTOs in section 2.7.

### 4.5 Caching

- Cache only data with a clear caching strategy.
- Consider caching public tender information and stable reference data.
- Define cache expiry and invalidation rules.
- Never share user-specific confidential data through a cache key that lacks the required security context.
- Do not cache financial or evaluation data without a documented security design.
- Introduce Redis when caching or distributed coordination is justified.

### 4.6 Background jobs

Use background jobs for tasks that need not block the HTTP response:

- Sending email notifications.
- Processing uploaded documents.
- Malware scanning.
- Generating reports.
- Expensive exports.
- Deadline reminders and the automatic tender status changes at each deadline.

Use a queue such as BullMQ with Redis when asynchronous processing is required. Jobs must be retry-safe and must not repeat a business action when run more than once.

## 5. Scalability and reliability

- Keep modules loosely coupled.
- Avoid shared mutable state between modules.
- Keep application instances stateless where possible.
- Store uploaded files outside the application server's local filesystem.
- Use database connection pooling appropriately.
- Design background jobs to support retries.
- Use idempotency for critical operations.
- Set timeouts for external service calls.
- Handle external service failures gracefully.
- Avoid unnecessary synchronous dependencies between modules.
- Use database migrations for schema changes, and test them before deploying.
- Define backup and recovery procedures before production use.

**Idempotency:** critical operations must be safe against accidental retries:

- Bid part submission.
- Evaluation submission.
- Award confirmation.
- Payment or contract actions, if introduced later.

If a `supplier` submits a bid part and the network fails before the response arrives, retrying must not create a second bid.

## 6. Clean code and maintainability

### 6.1 Naming conventions

- Classes: PascalCase.
- Variables and functions: camelCase.
- Constants: UPPER_SNAKE_CASE where appropriate.
- Database tables and fields: snake_case.
- Files: follow the agreed convention for each layer.
- Domain names in code use the glossary terms, for example `Tender`, `DraftTender`, `Bid`, `BidPart`, `TechnicalEvaluation`.

Names must communicate their purpose. Avoid vague names such as `data`, `item`, `process`, or `handle` when a more descriptive name exists.

### 6.2 Functions and classes

- Keep functions focused on one responsibility.
- Avoid unnecessarily large services and controllers.
- Extract reusable logic when it has a clear purpose.
- Avoid deeply nested conditions. Prefer early returns where they improve readability.
- Avoid unnecessary global state.
- Avoid duplicated business logic.

Do not create abstractions only to reduce the number of lines.

### 6.3 Error handling

- Use centralized exception handling.
- Return consistent API error responses with appropriate HTTP status codes.
- Never expose stack traces or internal details in production.
- Log errors with enough context.
- Distinguish validation errors, authorization errors, business rule violations, and unexpected server errors.
- Return 404, not 403, for resources a user is not allowed to see.

### 6.4 TypeScript

- Avoid `any` whenever possible.
- Define explicit types and interfaces.
- Use strict TypeScript settings.
- Avoid unsafe type assertions.
- Share API contracts where appropriate.
- Never treat front-end TypeScript types as back-end validation.

### 6.5 Code reuse

- Reuse business logic through services or domain abstractions.
- Do not copy validation or authorization rules.
- Keep shared utilities independent of specific business modules.
- Avoid a giant shared module that couples to everything.

## 7. API design

- Follow REST conventions with consistent resource names.
- Version APIs under `/api/v1`.
- Use appropriate HTTP methods and status codes.
- Use consistent response structures.
- Validate request parameters and bodies.
- Document endpoints with Swagger/OpenAPI at `/api/docs`, and in the Postman collection (v2.1) described in the submission requirements.
- Support pagination and filtering on collection endpoints.
- Never expose database models directly. Define request and response DTOs.

Example:

```text
GET    /api/v1/tenders
GET    /api/v1/tenders/:id
POST   /api/v1/draft-tenders
POST   /api/v1/draft-tenders/:id/accept
POST   /api/v1/tenders/:id/publish
```

Business actions such as accepting, publishing, raising committees, and awarding are explicit operations, each with its own authorization and business rule checks.

## 8. Audit logging

Auditability is a core business requirement. Record only the actions defined in [WORKFLOWS.md](../01_PROBLEM/WORKFLOWS.md) and the capability matrix:

- Draft tender created and accepted.
- Tender published, closed, moved to `under_evaluation`, and awarded.
- Legal information submitted for sign-up, sign-up accepted, and supplier information raised to the `admin`.
- Supplier account created, verification email sent, and email verified.
- Committees raised, and committee members approved.
- Bid part submitted and bid part replaced (who and when, without content).
- Evaluation submitted.
- Winning supplier sent to the `procurement_officer`.
- Unauthorized access attempts.

Add events as new workflows are agreed.

Each audit event captures, where appropriate:

- Actor ID.
- Action.
- Resource type and ID.
- Timestamp.
- Relevant context.
- Request or correlation ID.

Protect audit records against unauthorized change or deletion. Never store passwords, tokens, or confidential document contents in logs. Keep business audit logs separate from application and debug logs.

## 9. Testing

Every feature includes appropriate tests.

**Unit tests:** business rules, validation logic, tender status changes, permission decisions, and calculations.

**Integration tests:** database interactions, API endpoints, transactions, authorization enforcement, and module interactions.

**End-to-end tests** of the main journeys:

- `supplier_signup_process`.
- Tender publishing.
- Bid part submission.
- Deadline enforcement for each bid part.
- Independent Legal, Technical, and Financial Evaluations.
- Award.

**Security tests** verify at least that:

- Unauthorized access is rejected.
- A `supplier` cannot access other suppliers' bids.
- The `technical_committee` never receives financial information.
- The `technical_committee` and `financial_committee` never receive the supplier's identity.
- `admin`, `requester`, and `procurement_officer` cannot read bid contents.
- One person cannot be approved for both the technical and financial committees of one tender.
- Invalid tender status changes are rejected.
- Rate limits work.
- File uploads are validated.
- The sealed-bid acceptance check in [ADR 0004](../05_ARCHITECTURE/ADR/0004_TECHNOLOGY_STACK.md) passes.

A feature is not complete just because it works in the browser.

## 10. Git and code review

### Branching

Use feature branches:

- `main`: stable code.
- `develop`: integration branch if the team adopts one.
- `feature/*`: new functionality.
- `fix/*`: bug fixes.
- `hotfix/*`: urgent production fixes.

### Commits

Use Conventional Commits:

- `feat: add supplier registration`
- `fix: prevent duplicate bid submission`
- `refactor: extract tender validation service`
- `test: add evaluation authorization tests`
- `docs: update API documentation`

### Pull requests

- Do not push directly to protected branches.
- Every feature goes through a pull request.
- PRs have a clear description and reference the relevant task.
- CI checks must pass before merging.
- At least one teammate reviews the changes.
- Security-sensitive changes need careful review.
- Avoid large PRs that combine unrelated features.

## 11. Definition of Done

A task is not complete until:

- Business requirements are satisfied.
- Back-end validation is implemented.
- Authorization checks are implemented.
- Error handling is implemented.
- Database changes include migrations when needed.
- Relevant tests pass.
- API documentation is updated.
- No secrets or sensitive information are committed.
- Code follows the agreed conventions.
- Performance implications have been considered.
- The pull request is reviewed and approved.

## 12. Front end (Next.js)

**Security**

- Hiding buttons, pages, or routes is not security. Next.js middleware handles redirects only. The API makes every access decision.
- The JWT cookie is httpOnly and set by the API. The front end never reads it, and requests send it with `credentials: 'include'`.
- Only `NEXT_PUBLIC_API_URL` (front end) and `EXPO_PUBLIC_API_URL` (mobile) may be public. Never put secrets in `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variables.
- Never render user content with `dangerouslySetInnerHTML`.

**Data**

- Clear the whole TanStack Query cache on sign-out and sign-in, and never persist it to browser storage.
- Query keys for user-dependent data include the user's identity.
- Never edit the Orval-generated client by hand. Regenerate it when the Swagger spec changes.
- Front-end form validation is for usability only. Back-end DTOs make the real checks.
- Each screen uses the response DTO of its audience (section 2.7). A committee screen never requests another committee's view.

**Rendering and structure**

- Pages are Server Components by default. Add `"use client"` only where interaction or TanStack Query is needed. Public tender pages may render on the server.
- Use App Router route groups per area: `(public)`, `(auth)`, `(supplier)`, and `(staff)`. Each group has `loading.tsx`, `error.tsx`, and `not-found.tsx`.
- Put shadcn/ui components in `components/ui/` and feature components in `components/<domain>/`.
- Use Tailwind first. Use native CSS only in `globals.css` or CSS modules.

**Performance**

- Use `next/image` and `next/font`.
- Load heavy components with dynamic imports, and keep client bundles small.

## 13. Non-negotiable rules

1. Never trust front-end validation or authorization.
2. Never expose confidential bid information without explicit authorization.
3. Never show financial information to the `technical_committee`.
4. Never return unbounded database collections.
5. Never run database queries inside loops without evaluating the query strategy.
6. Never store passwords in plain text.
7. Never commit secrets.
8. Never store confidential documents in public storage.
9. Never bypass business rules to make a feature work.
10. Never change a submitted evaluation.
11. Never merge unreviewed code into protected branches.
12. Never introduce a new library or architectural pattern without discussing it with the team.
13. Never mark a task complete without appropriate testing.

Security, performance, and maintainability are shared responsibilities. Consider them during design and implementation, not as separate tasks at the end.
