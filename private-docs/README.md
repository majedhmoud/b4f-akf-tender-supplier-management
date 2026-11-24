# Shared team hand-off plan

This folder is now versioned and shared. Its existing name is retained. Earlier scaffold and slice commit schedules are superseded by one baseline commit under Majed's identity on `docs/p0-workflow-gaps`. Scaffold snapshots were removed because no historical split is needed.

S5 front end remains pending and paused. S5 back end is reported implemented; its new seed has not been loaded. S6 and S7 remain unimplemented. Committing the baseline does not close review findings or human acceptance.

## Timeline

Orders express dependencies, not dates. Orders 1–3 can review in parallel after order 0. Implementation requires an accepted proposal.

| Order | Member | Next work | Status |
|---|---|---|---|
| 0 | Majed | Commit and push the current baseline on the current branch | Authorized |
| 1 | Ali | Review S2–S4 back end and propose fixes for confirmed findings | Pending |
| 2 | Adham | Review public and supplier front end and propose fixes | Pending |
| 3 | Yazan | Review staff front end; S5 screens wait for resumption | Pending; S5 paused |
| 4 | Majed | Reconcile findings and plan S6 ranking and award | Proposal pending |
| 5 | Maya | Propose S7 mobile supplier companion | Not started |

## Hand-offs

- Plans: [Majed](MAJED.md), [Ali](ALI.md), [Adham](ADHAM.md), [Yazan](YAZAN.md), [Maya](MAYA.md).
- Each member commits only actual follow-up changes under their own identity. Do not recommit the baseline to imply new authorship. Reviews without changes require no commit.
- Follow the repository Git workflow for task branches and pull requests. Integrate the baseline before branching from updated `develop`.
- No test files are created or run; no browser automation. Record only static checks actually run and distinguish them from runtime verification.
- Exact staging paths and a descriptive Conventional Commit message are finalized after the approved change exists.
- Record only reported member contributions. Historical check counts are not current verification.
- A future formal repository is a separate decision; preserve the work's provenance when copying it.
