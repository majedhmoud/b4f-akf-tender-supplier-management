# Git Workflow

Status: accepted.

Use the formal [b4f-akf-tender-supplier-management repository](https://github.com/majedhmoud/b4f-akf-tender-supplier-management) and start task branches from its `develop` branch.

## Long-lived branches

| Branch | Purpose | Rule |
|---|---|---|
| `main` | Versions trusted for demo or hand-in | Protected. Receives only merges from `develop`. Every merge is tagged. |
| `develop` | Where finished tasks come together | Protected. Receives task pull requests under the review rule below. |

## Task branches

- One task, one owner, one reviewer, one branch.
- Branch from `develop`, and delete the branch after it is merged.
- Name branches `type/phase-or-slice-short-name`.

| Type | Use | Examples |
|---|---|---|
| `docs/` | Design and documentation | `docs/p1-erd`, `docs/p1-api-contract` |
| `chore/` | Setup and tooling | `chore/p0-repo-setup`, `chore/p0-docker-compose` |
| `feat/` | Slice work, split into back end, front end, and mobile | `feat/s1-tender-publishing-backend`, `feat/s1-tender-publishing-frontend`, `feat/s7-mobile-tenders` |
| `fix/` | Bug fixes, including after code freeze | `fix/s4-late-bid-check` |
| `test/` | Tests on their own | `test/s5-sealed-evaluation` |

## Merging

1. Open task pull requests into `develop`. Opening or closing a pull request requires no review. Merging into `develop` or `main` requires one teammate approval unless `majedhmoud`, the sole repository admin, uses the pull-request bypass. This applies to the person performing the merge, including when merging their own pull request. Direct pushes stay blocked.
2. Merge with a merge commit. Never squash-merge or rebase-merge: the history must show each member's own commits, and it is checked against the Project Brief. Use the pull request title as the merge commit title, for example `feat(s1): publish tender (backend)` or `docs(p1): add ERD`.
3. Merge `develop` into `main` at each checkpoint, and tag it:

| Checkpoint | Tag |
|---|---|
| End of P1 | `v0.1-design` |
| Code freeze | `v0.9-freeze` |
| Hand-in (by Tue Nov 24, 15:30) | `v1.0` |

After the code freeze, only `fix/` and `docs/` branches merge into `develop`.

## Authorship
- Each member commits and pushes their own tasks from their own GitHub account.
- Set `git config user.name` and `git config user.email` to the name and email linked to your own GitHub account.
- Never push another member's work under your own name.
- AI tools never appear in the history: no `Co-Authored-By` lines, no "Generated with" lines, and no AI names in commits, pull requests, or comments.
- Codex and Claude act only on `majedhmoud`'s tasks. On GitHub, Codex acts as `majedhmoud`: it never approves or merges a pull request that `majedhmoud` owns, and approves another member's pull request only when `majedhmoud` is its assigned reviewer and explicitly authorizes that approval.
