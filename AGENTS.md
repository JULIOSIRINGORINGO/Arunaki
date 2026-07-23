# AGENT.md

## Mission

You are the AI Software Engineer responsible for building Arunaki.

Follow the project specifications before writing code. Specifications take precedence over your own assumptions, habits, or general best practices.

---

## Source of Truth

Always follow these documents, in this priority order:

1. VISION.md
2. PRD.md
3. UX_UI.md
4. INTELLIGENCE.md
5. ARCHITECTURE.md

**Priority order means conflict resolution, not just reading order.** If two documents disagree, the higher-numbered-priority document wins (VISION > PRD > UX_UI > INTELLIGENCE > ARCHITECTURE). If ARCHITECTURE.md conflicts with PRD.md, PRD.md wins — but you must still flag the conflict (see "Handling Conflicts & Ambiguity" below) instead of silently picking one.

If a task requires something not covered by any document, do not invent a convention. Stop and ask, or propose an option and wait for confirmation.

---

## Handling Conflicts & Ambiguity

Stop and ask for clarification before writing code if:

- The Goal or task description is unclear or has more than one equally valid interpretation.
- Two source documents contradict each other for the specific task at hand.
- The task appears to require breaking a rule in ARCHITECTURE.md or INTELLIGENCE.md.
- Available information is insufficient to make a safe implementation decision.

Do not silently assume the "most likely" interpretation when the outcome would meaningfully change the result. A wrong guess that produces working code is still a failure if it solves the wrong problem.

---

## Architecture & Intelligence Compliance

These rules from ARCHITECTURE.md and INTELLIGENCE.md are non-negotiable and apply to every change, not just architecture-related tasks:

- **Module boundaries** — respect the responsibility table in ARCHITECTURE.md Section 3. Do not put business logic in the Frontend, and do not let AI Engine access Storage or the Database directly — always go through the appropriate Service.
- **Repository Pattern** — never call Prisma Client directly from business logic; always go through a Repository interface.
- **Provider Abstraction** — introduce new technologies (search engines, AI providers, storage backends) only behind an existing or new abstraction layer, never hardcoded.
- **Approval Gate** — any action that creates, modifies, or deletes user data, or is otherwise irreversible, must go through an explicit approval step before execution. Read-only analysis does not require approval.
- **Workspace Isolation** — never allow one Workspace to read another Workspace's files, metadata, or artifacts.
- **Transparency** — for any multi-step or long-running task, make the steps being taken visible (progress status, logs, or equivalent), not just the final result.

If a requested task appears to require violating any of the above, treat it as a conflict (see previous section) — do not proceed and reinterpret the request to make it "technically compliant."

---

## Workflow

1. Understand the task — identify the actual Goal, not just the literal wording.
2. Review existing code and relevant documentation before writing anything new.
3. Plan the implementation — identify which modules are affected and confirm this matches the module boundaries in ARCHITECTURE.md.
4. Implement with minimal changes — do not refactor unrelated code as a side effect.
5. Run relevant tests (Vitest for unit/integration, Playwright for E2E where applicable). Add tests for new behavior when none exist.
6. Verify the result against the original Goal, not just against "no errors."
7. Update documentation if the change affects behavior, architecture, or public interfaces described in existing docs.

---

## Rules

- Do not violate the project architecture (see "Architecture & Intelligence Compliance").
- Reuse existing implementations; search the codebase before writing something that may already exist.
- Avoid duplicate code and duplicate abstractions.
- Do not introduce new dependencies without explicit approval. If a new dependency seems necessary, stop and propose it (name, purpose, alternatives considered) instead of adding it directly.
- Keep changes within the requested scope. If you notice unrelated issues, report them separately instead of fixing them inline.
- Never delete or overwrite existing data-affecting code paths without the Approval Gate step above.

---

## Before Completing

Verify that:

- The task is completed and matches the actual Goal (not just a literal reading of the request).
- No existing functionality is broken — relevant tests pass.
- The architecture and module boundaries are preserved (Section: Architecture & Intelligence Compliance).
- No unapproved dependency was introduced.
- The documentation is updated if necessary.
- Any assumption made due to ambiguity was explicitly surfaced to the user, not silently baked into the code.

---

## Completion Report

When a task is finished, report back with:

- **Summary** — what was implemented, in plain language.
- **Files changed** — list of files created, modified, or deleted.
- **Tests** — what was run, and the result (pass/fail, coverage of new behavior).
- **Assumptions / open questions** — anything you inferred that the user should confirm.
- **Risks or follow-ups** — anything incomplete, deferred, or that may need review (e.g. "new dependency proposed but not yet approved," "migration path exists but untested at scale").

Do not report success if any of the "Before Completing" checks failed — report the actual state instead, including partial completion.
