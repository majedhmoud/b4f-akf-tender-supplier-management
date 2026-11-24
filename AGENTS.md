# Repository Guidelines

## Current working rules

- Keep work focused on requirements and documentation. Do not write code until P2. Tools are those in `docs/05_ARCHITECTURE/ADR/0004_TECHNOLOGY_STACK.md`; propose any other tool before using it.
- Keep updates, documents, and review comments concise.
- Test the product by running automated test files only. Do not use computer use or browser automation for product testing unless Majed explicitly changes this rule.
- Fix typos by default, and mention each typo fixed.
- Do only the step that was asked for. Do not move to the next step or phase, or raise its questions, until the user explicitly asks.
- Codex and Claude review each other’s changes. Use brief handoffs that identify the files changed, what needs review, and any open questions.
- Keep all Markdown under `docs/` except the root `README.md`, `AGENTS.md`, `CLAUDE.md`, and `.github/`.
- Inside `docs/`, name folders `NN_UPPER_SNAKE`, ADRs `NNNN_UPPER_SNAKE.md`, and other files `UPPER_SNAKE`. Exceptions: `docs/HAND_IN/` and `docs/postman/` use the names in the submission requirements. Code and tool folders (`backend/`, `frontend/`, `mobile/`, `.github/`) follow their own conventions.
- Follow `docs/HACKATHON_ROADMAP.md`. `docs/` has one folder per step (`01_PROBLEM/`, `02_EXISTING/`, …), created when it gets its first file. Propose each task for human verification. Edit files after ACCEPT. On MODIFY, revise and resubmit the proposal. On REJECT, stop.
- Store original PDFs in `docs/02_EXISTING/`. Use the Arabic project PDF as the source for the English description and keep the product requirements aligned with that description. Both Markdown documents belong in `docs/01_PROBLEM/`.
- Put teammate files that still need review, and their Markdown placeholders, in `docs/02_EXISTING/PENDING_REVIEW/`. Do not treat their content as requirements until reviewed.
- Follow `docs/04_RULES/GIT_WORKFLOW.md` for branches, pull requests, merges, and tags.
- Follow `docs/04_RULES/ENGINEERING_STANDARDS.md`.
- Follow `docs/01_PROBLEM/SUBMISSION_REQUIREMENTS.md`. When another rule conflicts with it, the submission requirements win.
- Keep the glossary in `docs/GLOSSARY.md`, and the capability matrix and decision records (ADRs) in `docs/05_ARCHITECTURE/`.
- `GLOSSARY.md` holds the shared language only: terms, definitions, and words to avoid. Put workflows in `docs/01_PROBLEM/WORKFLOWS.md`, duties in the capability matrix, and decisions in ADRs.
- The product is expandable. Keep domain areas separate and loosely coupled, so new areas can be added without reworking existing ones.
- Schedule requirements in the roadmap before designing them. Do not add a feature only because a document mentions it.
- Never add AI attribution (Co-Authored-By, "Generated with", AI names) to commits, pull requests, or GitHub content. Only team members appear in the repository.
