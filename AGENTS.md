# Repository Guidelines

## Current working rules

- Keep work focused on requirements and documentation. Do not write code until P2. Tools are those in `docs/05-architecture/adr/0004-technology-stack.md`; propose any other tool before using it.
- Keep updates, documents, and review comments concise.
- Fix typos by default, and mention each typo fixed.
- Do only the step that was asked for. Do not move to the next step or phase, or raise its questions, until the user explicitly asks.
- Codex and Claude review each other’s changes. Use brief handoffs that identify the files changed, what needs review, and any open questions. Record the outcome when the review takes place.
- Keep all Markdown under `docs/` except the root `AGENTS.md` and `CLAUDE.md`.
- Follow `docs/HACKATHON_ROADMAP.md`. `docs/` has one folder per step (`01-problem/`, `02-existing/`, …), created when it gets its first file. Propose each task for human verification. Edit files after ACCEPT. On MODIFY, revise and resubmit the proposal. On REJECT, stop.
- Store original PDFs in `docs/02-existing/`. Use the Arabic project PDF as the source for the English description and keep the product requirements aligned with that description. Both Markdown documents belong in `docs/01-problem/`.
- Put teammate files that still need review, and their Markdown placeholders, in `docs/02-existing/pending-review/`. Do not treat their content as requirements until reviewed.
- Keep the glossary in `docs/GLOSSARY.md`, and the capability matrix and decision records (ADRs) in `docs/05-architecture/`.
