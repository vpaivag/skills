---
name: intake
description: Front-door planning skill that gathers context before a coding task is planned. Requires the user to state their intent first; if /intake is invoked with no task, it asks for one and stops. Order is: restate → ask the 3 core questions (intent, scope, anchor) → explore the codebase bounded by those answers to resolve anything code can settle → continue asking only the follow-ups code couldn't answer (hard cap of 10 follow-ups in Phase 3 on top of the 3 core questions, asked one at a time via AskUserQuestion, recommended-answer option first). Recommends either /simple-plan or /deep-plan via an ADR-gate (hard-to-reverse / surprising-without-context / real-tradeoff / cross-concern — task spans multiple distinct kinds of change). File count is deliberately NOT a criterion: uniform bulk work (e.g. a 30-file rename) belongs in /simple-plan. Writes a single `context.md` artifact into a new suite directory under the configured plans directory (default `.claude/plans/`) and prints a handoff command for the user to run in a new session. Use when the user invokes /intake, asks to "gather context before planning", or wants a checkpoint before /deep-plan or /simple-plan.
---

# /intake

Run a bounded, conversational intake **before** any planner. The goal is to converge on shared understanding of the task — task intent, scope, where to look first — and to recommend the right planner (`/simple-plan` or `/deep-plan`). The skill writes a single artifact (`context.md`) into a new suite directory and ends with a handoff message.

This skill does NOT plan. It does NOT explore the codebase open-endedly. It does NOT invoke any downstream skill automatically.

## Asking questions

This skill prefers the `AskUserQuestion` tool for interactive prompts. If `AskUserQuestion` is not available (older Claude Code versions, restricted environments), fall back to plain text: print the question, list the options as a numbered list with the recommended option marked `(Recommended)`, and wait for the user's reply (a number or the option label). The skill proceeds normally in either mode — every call site below that says "call `AskUserQuestion`" follows this fallback rule.

## Plans directory

Resolve the plans directory before any path-touching action: read `.claude/plans-config.json` if present and use its `plansDir`; otherwise default to `.claude/plans`. The config also carries a `gitignore` boolean (default `true`) — only manage `.gitignore` when that flag is true. If the config file is missing or malformed, silently fall back to the defaults. Everywhere this skill says "the plans directory" below, it means the resolved value.

## Operating mode

- **Intent first, exploration second, questions third.** Do not touch the codebase before the user has stated what they want. Once intent is on the table and the 3 core questions are answered, you may explore — bounded by what those answers point at — to resolve follow-ups that code can settle. Do not roam the repo "just to understand it"; every read should retire a specific follow-up you would otherwise ask.
- **Read-only on code.** `Read`, `Glob`, and `Grep` only. No edits, no shell beyond `date` and the persist-phase `mkdir` / `.gitignore` write.
- **If code can answer it, read instead of asking.** During the escalate phase, before asking any follow-up, check whether `Read`/`Glob`/`Grep` would answer it deterministically. If yes, read; if the read is inconclusive, then ask. Inline the substitution in your turn ("Skipped follow-up on routing: confirmed by reading `src/router.ts:42`").
- **One write.** You may write exactly one file (`context.md`) inside one new directory under the plans directory, and may append the plans directory to `.gitignore` if not already present (only when the config's `gitignore` flag is true).
- **Do not invoke `grill-me` or any other skill.** This skill owns its own Q&A loop.

## Phases

Execute these phases in order. Do not skip ahead.

### Phase 1 — Restate (or ask for a task)

Read the user's initial task description.

- **If the user invoked `/intake` with no task description** (or a description so empty it conveys no intent), stop and reply with a short line asking for the task — e.g. "Give me something to intake — what are you trying to do?" — then end the turn. Do not touch the codebase. Do not create any directory. Wait for the user to come back with intent.
- **Otherwise**, restate the task in one short paragraph in your own words. Do not editorialize — just reflect the task back so the user can correct misreadings before any questions are asked. Do not explore the codebase yet — the user's framing comes first.

### Phase 2 — Core Q&A

Ask **3 core questions** up front, **one at a time**, via `AskUserQuestion`. Each question must include a **recommended-answer option** among the choices (label it with " (Recommended)" and put it first), to lower friction when the user agrees. Ask all three before any exploration — their purpose is to elicit the user's framing.

The three core questions cover, in order:
1. **Task intent** — one sentence describing what the user actually wants to accomplish (not the implementation).
2. **Scope** — is this one file, one module, or cross-module? Offer those as the options.
3. **Where to look first / what the user already knows** — a specific file, component, or concept to anchor on.

### Phase 3 — Interleaved explore ↔ ask

After the 3 core answers, walk down the decision tree one branch at a time. The loop is:

1. **Identify the next gap** that would block a planner (intent ambiguity, scope edge, an unresolved dependency between decisions, an open tradeoff).
2. **Try the codebase first.** If the gap is answerable by `Read` / `Glob` / `Grep` — existing patterns, current behavior, what a file already does, whether a dependency exists — read it and retire the gap. Inline the substitution in your turn ("Resolved via `src/router.ts:42` — already handles auth").
3. **Otherwise, ask one focused question** via `AskUserQuestion`, recommended-answer first. Only ask what code can't tell you: priorities, taste, future direction, constraints not visible in the repo, decisions between viable approaches.
4. **Use the answer to scope the next read**, then loop. Each user answer should narrow what you explore next; each read should sharpen the next question.

**Hard cap: 10 follow-up questions in Phase 3** (on top of the 3 core questions in Phase 2, so 13 total at the absolute limit). Ask only what closes a real gap — an unresolved dependency, an open tradeoff, a blast-radius signal the ADR-gate will need, or a missing essential (intent, scope, anchor) that the core Q&A didn't fully resolve. Do not pad to fill the budget. At 10 follow-ups, stop asking and write what you have, recording unresolved items in `context.md`'s `Open questions for the planner` section.

Do not mention the cap to the user — it's a budget for you, not a contract with them.

### Phase 4 — Recommend

Before applying the gate, produce a **kinds-of-work estimate** from what Phases 2 + 3 yielded. The point is to classify *what the work consists of*, not to count files. Identify which of the following are present:

- **Schema / migration** — database schema changes, new columns, indexes, data migrations, backfills.
- **Public API / contract** — externally consumed function signatures, HTTP routes, event payloads, file formats, CLI flags.
- **Persisted data** — anything written to disk or DB whose format other code or other deployments depend on.
- **Cross-concern work** — the task spans **multiple distinct kinds of change** (e.g. migration + model + serializer + UI, or backend logic + frontend rendering + tests of different shapes). Uniform bulk work (e.g. one rename applied across 30 files) is **not** cross-concern — it's a single kind of work repeated.
- **Genuine design choice** — a decision with 2+ viable approaches where the tradeoff is real (not manufactured).

Keep this classification internal to your reasoning — don't ask the user to validate it. It exists so the ADR-gate has the right signals to evaluate. **File count is not a criterion** — a 30-file uniform rename is fine for `/simple-plan`; a 4-file change spanning a migration, a model, a serializer, and a UI component is not.

Apply the **ADR-gate**. Recommend `/deep-plan` if any one of these is true; otherwise recommend `/simple-plan`:

1. **Hard-to-reverse** — touches database schema, public API contracts, file formats, persisted data, or is otherwise costly to roll back. Migrations almost always trip this even when they look mechanical.
2. **Surprising-without-context** — a future reader will plausibly ask "why was this done this way?" — the decision warrants documentation.
3. **Real-tradeoff** — 2 or more genuinely viable approaches exist with different complexity / performance / maintainability profiles.
4. **Cross-concern** — the task spans multiple distinct kinds of change that each deserve their own consideration (migration + model + serializer, backend + frontend + tests of different shapes, etc.). Uniform bulk work does **not** count.

Print the recommendation, citing which criterion fired (or "none — straightforward" if recommending `/simple-plan`). Then show both options and ask via `AskUserQuestion`:
- "Use recommendation"
- "Use the other one"
- "Cancel"

If the user picks "Cancel", stop without writing anything.

### Phase 5 — Persist

Only run this phase if Phases 2+3 produced content AND the user did not cancel.

1. Compute timestamp via `date +%Y-%m-%d-%H%M%S`.
2. Derive a kebab-case slug (≤6 words) from the task essence.
3. Create suite dir: `mkdir -p <plansDir>/<timestamp>-<slug>/`, where `<plansDir>` is the plans directory resolved above.
4. If the config's `gitignore` flag is true (default), and a `.gitignore` exists at the project root that does not already contain `<plansDir>/`, append `<plansDir>/` to it. If `.gitignore` does not exist, create it with that single line. Check before appending to avoid duplicates. If `gitignore` is false, skip this step entirely.
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
- Do not touch the codebase before Phase 1 has yielded a stated intent or before the 3 core questions in Phase 2 have been answered. Exploration is bounded to the user's stated scope/anchor.
- Prefer reading code over asking when the answer is deterministic. Only ask the user what code cannot answer.
- Do not exceed 10 follow-up questions in Phase 3 (on top of the 3 core questions in Phase 2 — 13 total at the limit).
- Do not create the suite directory until Phase 5 — if the user cancels or abandons mid-Q&A, no artifact is created.
- Do not auto-invoke downstream skills. End with the handoff block.
- Ask questions one at a time via `AskUserQuestion`, never batched.
- Each question must offer a recommended-answer option, placed first and labeled with " (Recommended)".
