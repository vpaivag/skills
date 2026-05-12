---
name: intake
description: Front-door planning skill that gathers context before a coding task is planned. Runs a short, bounded Q&A (≤5 questions, one at a time via AskUserQuestion, each with a recommended-answer option) to establish intent, scope, and where to look first, then recommends either /simple-plan or /deep-plan via an ADR-gate (hard-to-reverse / surprising-without-context / real-tradeoff). Writes a single `context.md` artifact into a new suite directory under `.claude/plans/` and prints a handoff command for the user to run in a new session. Use when the user invokes /intake, asks to "gather context before planning", or wants a checkpoint before /deep-plan or /simple-plan.
---

# /intake

Run a bounded, conversational intake **before** any planner. The goal is to converge on shared understanding of the task — task intent, scope, where to look first — and to recommend the right planner (`/simple-plan` or `/deep-plan`). The skill writes a single artifact (`context.md`) into a new suite directory and ends with a handoff message.

This skill does NOT plan. It does NOT explore the codebase open-endedly. It does NOT invoke any downstream skill automatically.

## Required tool

This skill requires the `AskUserQuestion` tool. If it is not available, stop immediately and tell the user this skill requires a recent version of Claude Code (run `claude update`).

## Operating mode

- **Read-only on code.** You may use `Read`, `Glob`, and `Grep`, but only as a deterministic substitute for a question you were about to ask (e.g. "does file X exist?"). Open-ended exploration is forbidden; that work belongs to the planner. Cap targeted reads at one per planned question; if the read does not yield a definitive answer, fall back to asking.
- **One write.** You may write exactly one file (`context.md`) inside one new directory under `.claude/plans/`, and may append `.claude/plans/` to `.gitignore` if not already present.
- **Do not invoke `grill-me` or any other skill.** This skill owns its own Q&A loop.

## Phases

Execute these phases in order. Do not skip ahead.

### Phase 1 — Restate

Read the user's initial task description. Restate it in one short paragraph in your own words. Do not editorialize — just reflect the task back so the user can correct misreadings before any questions are asked.

### Phase 2 — Core Q&A

Ask up to **3 core questions**, **one at a time**, via `AskUserQuestion`. Each question must include a **recommended-answer option** among the choices (label it with " (Recommended)" and put it first), to lower friction when the user agrees.

The three core questions cover, in order:
1. **Task intent** — one sentence describing what the user actually wants to accomplish (not the implementation).
2. **Scope** — is this one file, one module, or cross-module? Offer those as the options.
3. **Where to look first / what the user already knows** — a specific file, component, or concept to anchor on.

For any of these, if the answer is **deterministically findable in code** (e.g. "does `src/cli.ts` already parse flags?"), perform a single targeted read instead of asking, and inline the substitution in your turn ("Skipped Q2: confirmed by reading `src/cli.ts:14`").

### Phase 3 — Escalate (if needed)

If any core answer remained vague — operationally, the user picked "Other" with non-specific free text, or core answers are mutually inconsistent — ask up to **2 focused follow-ups** (same one-at-a-time, recommended-answer-first pattern).

**Soft cap: ~5 questions total across Phases 2 + 3.** Treat 5 as the strong default — stop there and proceed with best-effort context, recording unresolved items in `context.md`'s `Open questions for the planner` section.

**Override clause:** if after 5 questions the context is still too thin for a planner to act on (e.g. the task intent itself is unclear, scope is contradictory, or no anchor for "where to look first" has emerged), you may ask further questions. Constraints:
- Do **not** mention the cap, the override, or that you're exceeding a limit. Just ask the next question naturally, as if it were part of the normal flow.
- Each additional question must close a specific essential gap (intent, scope, or anchor) — not a nice-to-have.
- Never exceed **10 questions total** under any circumstance — at that point, write what you have and let the planner surface the rest.

The override clause is invisible to the user by design — the cap is a budget for you, not a contract with them.

### Phase 4 — Recommend

Apply the **ADR-gate**. Recommend `/deep-plan` if any one of these is true; otherwise recommend `/simple-plan`:

1. **Hard-to-reverse** — touches database schema, public API contracts, file formats, persisted data, or is otherwise costly to roll back.
2. **Surprising-without-context** — a future reader will plausibly ask "why was this done this way?" — the decision warrants documentation.
3. **Real-tradeoff** — 2 or more genuinely viable approaches exist with different complexity / performance / maintainability profiles.

Print the recommendation, citing which criterion fired (or "none — straightforward" if recommending `/simple-plan`). Then show both options and ask via `AskUserQuestion`:
- "Use recommendation"
- "Use the other one"
- "Cancel"

If the user picks "Cancel", stop without writing anything.

### Phase 5 — Persist

Only run this phase if Phases 2+3 produced content AND the user did not cancel.

1. Compute timestamp via `date +%Y-%m-%d-%H%M%S`.
2. Derive a kebab-case slug (≤6 words) from the task essence.
3. Create suite dir: `mkdir -p .claude/plans/<timestamp>-<slug>/`.
4. If a `.gitignore` exists at the project root and does not already contain `.claude/plans/`, append `.claude/plans/` to it. If `.gitignore` does not exist, create it with that single line. Check before appending to avoid duplicates.
5. Write `context.md` to the suite dir, following the schema in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md). Omit optional sections that have no content.

### Phase 6 — Handoff

Print exactly this block (filling in the bracketed values), then end the turn:

```
📄 Context written: <suite-dir>/context.md
▶ Recommended: /<recommended> (because: <criterion or "straightforward">)

Run in a new Claude Code session:
  claude "/<chosen> <suite-dir>"
```

Do NOT auto-invoke `/simple-plan` or `/deep-plan`. The handoff is the user's job — running it in a fresh session keeps the planner's context window clean.

## Constraints

- Do not invoke `grill-me` or any other skill.
- Do not do open-ended codebase exploration. Targeted reads only, and only as substitutes for specific questions.
- Do not exceed ~5 questions total across Phases 2+3.
- Do not create the suite directory until Phase 5 — if the user cancels or abandons mid-Q&A, no artifact is created.
- Do not auto-invoke downstream skills. End with the handoff block.
- Ask questions one at a time via `AskUserQuestion`, never batched.
- Each question must offer a recommended-answer option, placed first and labeled with " (Recommended)".
