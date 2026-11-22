# Git Workflow

Status: accepted.

## Long-lived branches

| Branch | Purpose | Rule |
|---|---|---|
| `main` | Versions trusted for demo or hand-in | Protected. Receives only merges from `develop`. Every merge is tagged. |
| `develop` | Where finished tasks come together | Protected. Receives only reviewed pull requests. |

## Task branches

- One task, one owner, one reviewer, one branch.
- Branch from `develop`, and delete the branch after it is merged.
- Name branches `type/phase-or-slice-short-name`.

| Type | Use | Examples |
|---|---|---|
| `docs/` | Design and documentation | `docs/p1-erd`, `docs/p1-api-contract` |
| `chore/` | Setup and tooling | `chore/p0-repo-setup`, `chore/p0-docker-compose` |
| `feat/` | Slice work, split into back end and front end | `feat/s1-tender-publishing-api`, `feat/s1-tender-publishing-web` |
| `fix/` | Bug fixes, including after code freeze | `fix/s4-late-bid-check` |
| `test/` | Tests on their own | `test/s5-sealed-evaluation` |

## Merging

1. Open a pull request into `develop`. The task's reviewer approves it. Owners cannot approve their own pull requests.
2. Squash-merge, so each task becomes one commit. Use the pull request title as the commit message, for example `feat(s1): publish tender (api)` or `docs(p1): add ERD`.
3. Merge `develop` into `main` at each checkpoint, and tag it:

| Checkpoint | Tag |
|---|---|
| End of P1 | `v0.1-design` |
| Code freeze | `v0.9-freeze` |
| Hand-in | `v1.0` |

After the code freeze, only `fix/` and `docs/` branches merge into `develop`.
