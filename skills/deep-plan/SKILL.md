---
name: deep-plan
description: Produce a thorough, self-contained implementation plan for a coding task. Explores the codebase read-only, considers alternatives, enumerates risks, and writes a plan suite (an index plus one or more chunk files) that can be executed in a fresh Claude Code session via /execute-plan. Detects under-decomposed tasks to offer splits. Use this when the user invokes /deep-plan or asks for a deep plan before implementation.
---

# /deep-plan

Produce a rigorous implementation plan and persist it as a self-contained suite of files that can be executed by a fresh Claude Code session with no prior conversation context.

Every plan is written as a **suite directory** containing an `index.md` and one or more chunk files — even when there is a single chunk. This keeps the on-disk shape uniform for `execute-plan` and `plan-tracker`.

## Operating mode

**This skill is READ-ONLY during stages Restate through Verify.** You may use `Read`, `Glob`, `Grep`, and read-only `Bash` commands (e.g. `git log`, `git diff --stat`, `find`, `cat`, `ls`). You must NOT use `Edit`, `Write`, or `MultiEdit`, and you must not run any `Bash` command that modifies files, git state, or external systems. The only writes permitted are in Persist (creating plan files and updating `.gitignore`) and Confirm (deleting plan files on user discard).

If you find yourself wanting to edit during exploration, stop and add the desired edit to the plan instead.

## Asking questions

This skill prefers the `AskUserQuestion` tool for interactive prompts. If `AskUserQuestion` is not available (older Claude Code versions, restricted environments), fall back to plain text: print the question, list the options as a numbered list with the recommended option marked `(Recommended)`, and wait for the user's reply (a number or the option label). The skill proceeds normally in either mode — every call site below that says "call `AskUserQuestion`" follows this fallback rule.

## Plans directory

Resolve the plans directory before any path-touching action: read `.claude/plans-config.json` if present and use its `plansDir`; otherwise default to `.claude/plans`. The config also carries a `gitignore` boolean (default `true`) — only manage `.gitignore` when that flag is true. If the config file is missing or malformed, silently fall back to the defaults. Everywhere this skill says "the plans directory" or `<plansDir>` below, it means the resolved value.

## Project conventions

Before Explore, read `CLAUDE.md` at the project root if it exists. It contains references to other documentation — follow those references and read the linked docs. Treat `CLAUDE.md` and its referenced docs as authoritative project context that must be honored in the plan.

## Stages

Execute these stages in order. Do not skip ahead. Do not collapse multiple stages into one response.

### Stage: Adopt

Before restating, decide whether this invocation **adopts** an existing suite directory that already contains a `context.md` (typically written by `/intake`) or **mints** a fresh one later in Persist.

Detection:

1. If invoked with an argument that is an existing directory under the plans directory containing a `context.md`, **adopt** it.
2. If invoked with no argument and exactly one directory under the plans directory contains a `context.md`, no `index.md`, and no `simple-plan.md`, **adopt** that directory.
3. Otherwise, **mint** — defer creation to Persist as usual.

Refusal rule: if the candidate suite dir already contains an `index.md`, **refuse and ask the user** before doing anything else (e.g. "An existing plan is present — overwrite, write a new suite, or cancel?"). Overwriting is destructive and must not happen silently.

On adoption:

1. Read `context.md` before any other action.
2. Print the acknowledgment line at the top of this response:
   ```
   📥 Adopted intake context from <path>/context.md
   ```
3. Carry the adopted `context.md` into Restate — its `## Task`, assumptions, and constraints seed the restatement.
4. Write all Persist outputs (`index.md` + chunk files) into this same directory; do **not** mint a new one.

Malformed `context.md` (missing H1, frontmatter, or `## Task`): log `⚠ Ignoring malformed context.md at <path> — proceeding without it.` and proceed with a normal Restate, but still write outputs into the existing dir.

### Stage: Restate

In your own words, restate the task the user asked for. Then list:
- **Assumptions** you're making (bullets)
- **Ambiguities** you need to resolve (questions)

If a `context.md` was adopted in Adopt, **seed this stage from it**: pull the restatement from its `## Task` section and lift any assumptions / constraints it lists, tagging them `(from intake)`. Treat `## Open questions for the planner` in `context.md` as ambiguities to resolve here.

**Resolve every ambiguity and every assumption with the user — do not silently default.** Batch all of them into a **single** `AskUserQuestion` call (one question per ambiguity/assumption, up to the tool's per-call limit; if there are more, batch the remainder into a follow-up call). For each question:

- Provide exactly **one** option: the reasonable default you'd otherwise have silently assumed, labeled with `(Recommended)`.
- Do not invent alternative answers to pad the list. The user can pick "Other" (auto-provided by the tool) to give any different answer they want.

After the user answers, record their resolved choices in the restated Restate (no more "Assumptions" vs "Ambiguities" split — every item is now a **resolved decision**, with attribution: `(user-confirmed)` or `(from intake)`). Then continue to Explore.

If there are no ambiguities and no assumptions worth flagging, skip the `AskUserQuestion` call.

### Stage: Explore

Read every file the change is likely to touch. Read the surrounding code. Read tests for affected modules. Read `CLAUDE.md` and the docs it references.

Document:
- **Existing patterns and conventions** relevant to this task (how similar things are done elsewhere in this codebase)
- **Gotchas, non-obvious behavior, or constraints** you discovered
- **Dependencies and integration points** that will be affected

Be thorough. The executor will not have access to anything you don't externalize into the plan file.

#### End of Explore: re-check Restate

After exploration, **explicitly check** whether what you learned changes the problem statement, assumptions, or ambiguities from Restate. If yes, update Restate before proceeding, and announce the change visibly:

```
⚠️ Restate updated based on exploration:
   - <field changed>: "<old>" → "<new>"
     reason: <what you found that changed it>
   - <new ambiguity discovered>: <description>
     reason: <what surfaced it>
```

Do NOT silently rewrite Restate — the user needs to see drift in real time, before approving the plan in Confirm.

If Restate had blocking ambiguities that exploration resolved, mark them resolved with the resolution. If exploration introduced new blocking ambiguities, stop and ask the user before continuing.

### Stage: Design

Consider the design space before committing.

- If 2+ approaches are genuinely viable, present each with a 1–3 sentence description and tradeoffs (complexity, performance, blast radius, maintainability, reversibility). Pick one and explain **why this one and why not the others** — the "why not" matters as much as the "why."
- If only one approach is genuinely viable, name the alternatives you considered and why each is a non-starter (wrong tool for the constraints, blocked by an existing decision, prohibitive cost, etc.). One sentence per rejected alternative is enough.

The point is to prove you considered alternatives — not to manufacture strawmen. If you find yourself inventing a weak alternative just to have two, that's a signal there is only one viable path; document that honestly instead.

#### User checkpoint (only when ≥2 alternatives were genuinely viable)

If you presented 2+ viable alternatives above, **do not lock in your recommendation alone** — call `AskUserQuestion` with:

- **Question:** "Which approach should I plan?"
- **Options** (one per presented alternative): label = the alternative's name, description = the 1–3 sentence summary you gave for it. Mark the one you recommended with `(Recommended)`.
- Optionally include "Other — describe a different approach" as an additional option.

If the user picks a non-recommended option, restate the chosen approach and the reasoning **before** proceeding to Specify so the rest of the plan reflects that choice.

If only one approach was viable, skip the checkpoint.

### Stage: Specify

- **Every file that changes**, with a one-line statement of intent per file
- **Every interface that changes**: function signatures, types, schemas, API contracts
- **Order of operations**: numbered steps with explicit dependencies between steps

Follow the code-in-plans rule when describing changes. The rule and examples live in [PLAN-FORMAT.md](./PLAN-FORMAT.md).

### Stage: Risk

- **Edge cases**: empty inputs, large inputs, unicode, concurrency, partial failure, network failure, timeouts, retries
- **Failure modes** specific to this change
- **Reversibility**: if this goes wrong in production, how do we undo it?

### Stage: Verify

- **Test strategy**: what tests to add, what tests to update, what's already covered
- **Acceptance criteria**: a numbered checklist the executor can tick off. Each item must be objectively verifiable.

### Stage: Decompose

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

If the plan should NOT split, proceed to Persist with a single chunk.

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

Ask in plain text: "How would you like to decompose this?" Wait for response, accept the user's chunking, then proceed to Persist with that decomposition.

### Stage: Persist

Every plan — whether single-chunk or multi-chunk — is written to a suite directory.

1. Get a timestamp: `date +%Y-%m-%d-%H%M%S`.
2. Derive a kebab-case slug (≤6 words) from the task essence.
3. Create the suite directory: `mkdir -p <plansDir>/<timestamp>-<feature-slug>`, where `<plansDir>` is the plans directory resolved above.
4. If the config's `gitignore` flag is true (default), and a `.gitignore` exists at the project root that does not already contain `<plansDir>/`, append the line `<plansDir>/` to it. If `.gitignore` does not exist, create it with that single line. If `gitignore` is false, skip this step entirely.

#### Single-chunk suite

Write two files inside the suite directory:

- `index.md` — using the single-chunk format in [INDEX-FORMAT.md](./INDEX-FORMAT.md).
- `plan.md` — the chunk file itself, using the format in [PLAN-FORMAT.md](./PLAN-FORMAT.md). The chunk's frontmatter `Depends on:` is `(none)` and `Part of suite:` points to the sibling `index.md`.

#### Multi-chunk suite

Write the index plus one chunk file per chunk:

- `index.md` — using the multi-chunk format in [INDEX-FORMAT.md](./INDEX-FORMAT.md), listing each chunk with its filename, status `pending`, and dependencies.
- `<chunk-filename>.md` per chunk — using the format in [PLAN-FORMAT.md](./PLAN-FORMAT.md). Use kebab-case filenames derived from chunk names (e.g. `listener.md`, `sync-job.md`).

Each chunk file MUST be self-contained. The executor for chunk B should not need to read chunk A's file — only the parts of chunk A's *output in the codebase* that B depends on. State those dependencies clearly in chunk B's Context section.

### Stage: Confirm

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

After the user responds, update the plan files in place to incorporate the changes. If the revision requires additional exploration, perform it read-only first, then update. If the revision changes the decomposition (e.g. "actually merge chunks 2 and 3", or "split this into two chunks"), restructure the suite directory accordingly — including renaming/recreating `plan.md` ↔ named chunk files as needed, and updating `index.md`. Then return to the start of Confirm (re-print summary, re-call `AskUserQuestion`). Loop until Approve or Discard.

#### If the user picks Discard

Delete the suite directory: `rm -rf <suite-directory>`.

Confirm:

```
🗑️  Plan discarded and deleted.
```

End your turn.

## Constraints (re-emphasis)

- Do not write or edit any files except the suite directory contents in Persist and `.gitignore` in Persist.
- Do not run any command that modifies repository state during exploration.
- Do not skip or collapse stages into a single response.
- Do not print the execute command before Confirm approval.
- Do not silently fill in missing requirements — ask the user in Restate, or document them as explicit assumptions.
- Do not write implementation bodies in plans — interfaces and intent only. The executor designs implementation.
- Do not silently update Restate mid-flight — announce the change visibly per the Explore end-check.
- Always emit a suite directory with `index.md`, even for single-chunk plans. Never write a bare `.md` file directly under the plans directory.