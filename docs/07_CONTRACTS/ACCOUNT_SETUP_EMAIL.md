# Account Setup Email Contract Check

Status: historical execution recorded on November 24, 2026; delivery review findings remain open. These results do not verify the latest changes.

Sources: [ADR 0005](../05_ARCHITECTURE/ADR/0005_AUTOMATIC_SUPPLIER_ACCOUNT_SETUP.md), [API setup flow](../05_ARCHITECTURE/API_CONTRACT.md#sign-up-and-account-setup), [ERD email rules](../05_ARCHITECTURE/ERD.md#emails), and [security standards](../04_RULES/ENGINEERING_STANDARDS.md#21-authentication).

## Test boundary

Run automated test files against local PostgreSQL, Redis/BullMQ, Nodemailer and Mailpit, using the [accepted native services](../05_ARCHITECTURE/ADR/0004_TECHNOLOGY_STACK.md). Capture messages through Mailpit's HTTP API; do not use its browser interface. Use fictional recipients and isolate each test by a unique address. Never contact a real mailbox.

Drive legal acceptance and admin acceptance through the API. Then wait with a bounded timeout for the worker and captured message. Inspect database state, SMTP outcome and the captured body separately. Account provisioning alone is not proof of delivery.

## Required assertions

| Case | Expected evidence |
|---|---|
| Initial provisioning | One supplier/account/token/email set committed with admin acceptance. Account is `pending_setup`; message starts `sending`; no send before commit. Rejection creates none. |
| Recipient and language | Correct applicant address; subject/body in the applicant's preferred `en` or `ar`. `EMAIL_MESSAGE.language` is the preparation-time snapshot. Changing preference later does not rewrite this message. |
| Link | Configured web origin followed by `/{lang}/account-setup#token=…`. Token is in the fragment, never a query parameter or URL path; no password is emailed. |
| Storage and logging | `ACCOUNT_SETUP_TOKEN` contains the hash and expiry, not the raw token. Raw tokens/passwords are absent from logs. The emailed link is handled as sensitive test data. |
| Non-consuming verification | Verify twice successfully before expiry; both checks leave the token unused and return masked email, preferred language and supplier account type. |
| Successful completion | Completing once activates the account, verifies email and establishes the session. Reuse returns `410 SETUP_LINK_USED`; concurrent completion cannot succeed twice. |
| Expiry and resend | Advance the test clock past configured expiry: verify/complete return `410 SETUP_LINK_EXPIRED`. Resend returns 202; an eligible resend delivers a new usable link. Invalid/used-token resend still returns 202 without creating an unauthorized account. |
| Delivery failure | Confirmed non-delivery records `failed`, `failure_code`, and `failed_at`. A retry clears failure metadata when claiming delivery and retains the same delivery identity for that attempt. |
| Uncertain acceptance | Message remains `sending`. Do not blindly resend; recover/confirm using the ERD delivery rules. Mailpit capture alone does not establish exactly-once delivery under every SMTP failure. |
| Restart/enqueue recovery | A committed provisioning/email record survives worker or enqueue interruption. Recovery completes delivery without another supplier, account or first-token provisioning transaction. |

Run the happy path separately for English and Arabic. Save assertion summaries with test names and counts; do not save live setup links or full email bodies in repository artifacts.

## Results

Command: `npm run test:e2e` in `backend/`, run twice: 13 files, 109 tests, all passing both times. Local services: PostgreSQL 18, Redis 8.12 and Mailpit 1.34, installed natively. Settings: `REDIS_URL`, `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` and `SETUP_TOKEN_SECRET` in `backend/.env`. Each test file uses its own `QUEUE_PREFIX`, removed from Redis after the run.

| Case | Test (file › name) | Result |
|---|---|---|
| Initial provisioning | `account-setup` › the full path in en / ar; answers 404 for a rejected request | Pass |
| Recipient and language | the full path in en / ar; keeps the email language from preparation time | Pass |
| Link | the full path in en / ar | Pass |
| Storage and logging | the full path in en / ar: only the token hash is stored, and the email row keeps a `{{setupLink}}` placeholder | Pass |
| Non-consuming verification | the full path in en / ar | Pass |
| Successful completion | the full path in en / ar; lets only one of two simultaneous completions succeed | Pass |
| Expiry and resend | expires links after 48 hours; answers 202 to every resend; sends at most 5 links an hour | Pass |
| Delivery failure | `email-delivery` › temporary refusal; permanent refusal; retries a failed email | Pass |
| Uncertain acceptance | `email-delivery` › keeps an uncertain delivery at sending | Pass |
| Restart/enqueue recovery | `account-setup` › recovers a committed email whose enqueue never happened | Pass |

Also checked: U7 conflicts in contract order (`ALREADY_ACCEPTED` with `details.supplierId`, including simultaneous requests; `EMAIL_ALREADY_REGISTERED`; `REGISTRATION_NUMBER_EXISTS` keeping the request raised), and `classify` unit tests for each SMTP outcome.

How delivery decides an outcome:

- An SMTP refusal, or a connection that never opened, is a confirmed non-delivery. A permanent refusal fails at once; the rest are retried, then fail with `DELIVERY_FAILED`.
- A connection lost after the message was handed over is uncertain. The row stays `sending`, but the current worker automatically retries before retaining the exhausted job. Reusing `Message-ID` alone does not establish provider deduplication; see the review follow-up below.
- Recovery runs when the API starts and every minute. It queues any `sending` email that has no job.

Still open:

- An uncertain email stays `sending` until someone confirms the outcome with the provider. No V1 screen shows or resolves it.
- No endpoint retries a failed setup email. When the link expires, the supplier asks for a new one (S3). The officer email retry belongs to the award slice.
- The token lifetime (48 hours) and the password policy (at least 12 characters) are settled in the [S2 slice](../06_SLICES/S2_SUPPLIER_SIGNUP.md) and [ENGINEERING_STANDARDS.md](../04_RULES/ENGINEERING_STANDARDS.md#21-authentication). Committee-member provisioning belongs to S3; the setup endpoints already answer `accountType: "committee_member"` and `next: "my_assignments"` for an account with no supplier.

## Review follow-up

The inherited baseline was rerun: 21 unit tests passed; 109 e2e tests passed twice; lint, formatting, typecheck, build and schema comparison passed. The following source-review findings remain unresolved by that result:

- Uncertain SMTP outcomes are automatically retried; the existing test expects two attempts. This does not prove compliance with the ERD's requirement to confirm the outcome or use provider-supported deduplication before retrying.
- The five-link hourly limit currently counts prepared emails, including unsent/failed ones, rather than sent emails. Queued/concurrent sends also need consideration when correcting the count.
- The password DTO limits characters, while bcrypt truncates at 72 bytes. The password-limit behavior needs an agreed correction.
- Lock ordering across different valid setup tokens, resend state rechecks under the account lock, and recovery/test isolation need review; the concurrency risk has not been reproduced.

No corrective backend edits or new regression tests were made during this review. Further test-file creation and test runs are now paused by human direction. Preserve the historical results above without treating them as proof that these findings or the latest setup/profile changes are resolved. Local delivery is captured in Mailpit; it is not delivery to a real mailbox.
