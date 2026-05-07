---
name: deep-plan
description: Produce a thorough, self-contained implementation plan for a coding task. Explores the codebase read-only, considers alternatives, enumerates risks, and writes a plan suite (an index plus one or more chunk files) that can be executed in a fresh Claude Code session via /execute-plan. Detects under-decomposed tasks and offers to split them. Use this when the user invokes /deep-plan or asks for a deep plan before implementation.
---

# /deep-plan

Produce a rigorous implementation plan and persist it as a self-contained suite of files that can be executed by a fresh Claude Code session with no prior conversation context.

Every plan is written as a **suite directory** containing an `index.md` and one or more chunk files — even when there is a single chunk. This keeps the on-disk shape uniform for `execute-plan` and `plan-tracker`.

## Operating mode

**This skill is READ-ONLY during phases 1–6.** You may use `Read`, `Glob`, `Grep`, and read-only `Bash` commands (e.g. `git log`, `git diff --stat`, `find`, `cat`, `ls`). You must NOT use `Edit`, `Write`, or `MultiEdit`, and you must not run any `Bash` command that modifies files, git state, or external systems. The only writes permitted are in Phase 7 (creating plan files and updating `.gitignore`) and Phase 8 (deleting plan files on user discard).

If you find yourself wanting to edit during exploration, stop and add the desired edit to the plan instead.

## Required tool

This skill requires the `AskUserQuestion` tool. If it is not available, stop immediately and tell the user this skill requires a recent version of Claude Code (run `claude update`).

## Project conventions

Before Phase 2, read `CLAUDE.md` at the project root if it exists. It contains references to other documentation — follow those references and read the linked docs. Treat `CLAUDE.md` and its referenced docs as authoritative project context that must be honored in the plan.

## Phases

Execute these phases in order. Do not skip ahead. Do not collapse multiple phases into one response.

### Phase 1 — Restate

In your own words, restate the task the user asked for. Then list:
- **Assumptions** you're making (bullets)
- **Ambiguities** you need to resolve (questions)

If there are blocking ambiguities, ask the user and stop. If assumptions are reasonable defaults, document them and continue, but flag them clearly.

### Phase 2 — Explore (read-only)

Read every file the change is likely to touch. Read the surrounding code. Read tests for affected modules. Read `CLAUDE.md` and the docs it references.

Document:
- **Existing patterns and conventions** relevant to this task (how similar things are done elsewhere in this codebase)
- **Gotchas, non-obvious behavior, or constraints** you discovered
- **Dependencies and integration points** that will be affected

Be thorough. The executor will not have access to anything you don't externalize into the plan file.

#### End of Phase 2: re-check Phase 1

After exploration, **explicitly check** whether what you learned changes the problem statement, assumptions, or ambiguities from Phase 1. If yes, update Phase 1 before proceeding, and announce the change visibly:

```
⚠️ Phase 1 updated based on exploration:
   - <field changed>: "<old>" → "<new>"
     reason: <what you found that changed it>
   - <new ambiguity discovered>: <description>
     reason: <what surfaced it>
```

Do NOT silently rewrite Phase 1 — the user needs to see drift in real time, before approving the plan in Phase 8.

If Phase 1 had blocking ambiguities that exploration resolved, mark them resolved with the resolution. If exploration introduced new blocking ambiguities, stop and ask the user before continuing.

### Phase 3 — Design

Generate **at least two distinct approaches** to the problem. For each:
- 1–3 sentence description
- Tradeoffs on: complexity, performance, blast radius, maintainability, reversibility

Pick one approach. Explicitly state **why this one and why not the others**. The "why not" matters as much as the "why."

### Phase 4 — Specify

- **Every file that changes**, with a one-line statement of intent per file
- **Every interface that changes**: function signatures, types, schemas, API contracts
- **Order of operations**: numbered steps with explicit dependencies between steps

Follow the code-in-plans rule when describing changes. The rule and examples live in [PLAN-FORMAT.md](./PLAN-FORMAT.md).

### Phase 5 — Risk

- **Edge cases**: empty inputs, large inputs, unicode, concurrency, partial failure, network failure, timeouts, retries
- **Failure modes** specific to this change
- **Reversibility**: if this goes wrong in production, how do we undo it?

### Phase 6 — Verify

- **Test strategy**: what tests to add, what tests to update, what's already covered
- **Acceptance criteria**: a numbered checklist the executor can tick off. Each item must be objectively verifiable.

### Phase 6.5 — Decomposition check

Evaluate whether this plan should be split into multiple chunks. The trigger is **internal coherence**, not size: does the plan contain 2+ units of work that are each internally coherent and would each merit their own focused execution session?

Examples that should split:
- "Implement an MQTT listener that triggers a sync via an API endpoint and a background job" → 3 chunks (listener, endpoint, sync job) — each has its own design surface, edge cases, and verification.
- "Add OAuth login with Google and GitHub providers, plus a session middleware" → 3 chunks (Google provider, GitHub provider, middleware).

Examples that should NOT split:
- "Rename `User#email` to `User#email_address` across the codebase" → one chunk even if many files change. Same kind of work everywhere.
- "Add a `created_at` index to 5 tables" → one chunk. Repetitive, single concern.

Soft signals that *suggest* (don't gate) decomposition:
- Files Changed > ~8
- Implementation Steps > ~10
- Acceptance Criteria fall into clearly distinct groups

If the plan should NOT split, proceed to Phase 7 with a single chunk.

If it SHOULD split, present a **lightweight decomposition** and ask the user.

#### Lightweight decomposition format

```
📦 This plan looks like it should be split into N chunks:

  1. <chunk-name> — <1-line scope>
     Depends on: (none) | <other chunks>
  2. <chunk-name> — <1-line scope>
     Depends on: <other chunks>
  ...
```

Then call `AskUserQuestion`:
- **Question**: "Split into multiple plans, or keep as one?"
- **Options** (single-select):
  1. "Split as suggested"
  2. "Keep as one plan"
  3. "Explain the decomposition"
  4. "I'll describe a different decomposition"

#### If user picks "Explain the decomposition"

Print a heavyweight justification:
- For each chunk: which files belong to it, why this seam is the right one, what alternative seams were considered and rejected.
- Then re-ask the same `AskUserQuestion` (without the "Explain" option this time).

#### If user picks "I'll describe a different decomposition"

Ask in plain text: "How would you like to decompose this?" Wait for response, accept the user's chunking, then proceed to Phase 7 with that decomposition.

### Phase 7 — Persist

Every plan — whether single-chunk or multi-chunk — is written to a suite directory.

1. Get a timestamp: `date +%Y-%m-%d-%H%M%S`.
2. Derive a kebab-case slug (≤6 words) from the task essence.
3. Create the suite directory: `mkdir -p .claude/plans/<timestamp>-<feature-slug>`.
4. If a `.gitignore` exists at the project root and does not already contain `.claude/plans/`, append the line `.claude/plans/` to it. If `.gitignore` does not exist, create it with that single line.

#### Single-chunk suite

Write two files inside the suite directory:

- `index.md` — using the single-chunk format in [INDEX-FORMAT.md](./INDEX-FORMAT.md).
- `plan.md` — the chunk file itself, using the format in [PLAN-FORMAT.md](./PLAN-FORMAT.md). The chunk's frontmatter `Depends on:` is `(none)` and `Part of suite:` points to the sibling `index.md`.

#### Multi-chunk suite

Write the index plus one chunk file per chunk:

- `index.md` — using the multi-chunk format in [INDEX-FORMAT.md](./INDEX-FORMAT.md), listing each chunk with its filename, status `pending`, and dependencies.
- `<chunk-filename>.md` per chunk — using the format in [PLAN-FORMAT.md](./PLAN-FORMAT.md). Use kebab-case filenames derived from chunk names (e.g. `listener.md`, `sync-job.md`).

Each chunk file MUST be self-contained. The executor for chunk B should not need to read chunk A's file — only the parts of chunk A's *output in the codebase* that B depends on. State those dependencies clearly in chunk B's Context section.

### Phase 8 — Confirm

Print a concise summary. Use the same shape for single- and multi-chunk suites; only the chunk count differs.

```
📋 Suite summary
   Index: <path-to-index>
   Goal: <one-line>
   Chunks: <count>
     1. <chunk-name> — <files> files, <criteria> criteria
     2. ...
```

For a single-chunk suite the chunk list still appears (one entry).

Then call `AskUserQuestion`:
- **Question**: "Plan written. Ready to execute, revise, or discard?"
- **Options** (single-select):
  1. "Approve — show execute command"
  2. "Revise — I'll describe changes"
  3. "Discard plan"

#### If the user picks Approve

Print:

```
✅ Approved.

Execute chunks in dependency order from the project root in a fresh terminal:

  Runnable now (no dependencies):
    claude "/execute-plan <path-to-chunk>"
    ...

  Blocked (run after dependencies complete):
    claude "/execute-plan <path-to-chunk>"  (depends on: <deps>)

Use /plan-tracker to see live status across the suite.
```

For a single-chunk suite there will be exactly one entry under "Runnable now" and no "Blocked" section.

End your turn.

#### If the user picks Revise

Ask in plain text: "What would you like to change?"

After the user responds, update the plan files in place to incorporate the changes. If the revision requires additional exploration, perform it read-only first, then update. If the revision changes the decomposition (e.g. "actually merge chunks 2 and 3", or "split this into two chunks"), restructure the suite directory accordingly — including renaming/recreating `plan.md` ↔ named chunk files as needed, and updating `index.md`. Then return to the start of Phase 8 (re-print summary, re-call `AskUserQuestion`). Loop until Approve or Discard.

#### If the user picks Discard

Delete the suite directory: `rm -rf <suite-directory>`.

Confirm:

```
🗑️  Plan discarded and deleted.
```

End your turn.

## Constraints (re-emphasis)

- Do not write or edit any files except the suite directory contents in Phase 7 and `.gitignore` in Phase 7.
- Do not run any command that modifies repository state during exploration.
- Do not skip or collapse phases into a single response.
- Do not print the execute command before Phase 8 approval.
- Do not silently fill in missing requirements — ask the user in Phase 1, or document them as explicit assumptions.
- Do not write implementation bodies in plans — interfaces and intent only. The executor designs implementation.
- Do not silently update Phase 1 mid-flight — announce the change visibly per the Phase 2 end-check.
- Always emit a suite directory with `index.md`, even for single-chunk plans. Never write a bare `.md` file directly under `.claude/plans/`.