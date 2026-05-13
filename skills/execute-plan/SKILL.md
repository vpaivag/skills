---
name: execute-plan
description: Execute a chunk file produced by /deep-plan. Reads the specified chunk, validates suite dependencies via the suite index, confirms files and order with the user, implements in sequence, verifies each acceptance criterion, and prompts for the final status update. Use when the user invokes /execute-plan <path>.
---

# /execute-plan

Implement the chunk at the path provided by the user. Every plan produced by `/deep-plan` is a **suite** — a directory containing `index.md` and one or more chunk files. Even a single-chunk plan is a suite (the chunk lives at `<suite-dir>/plan.md`).

## Usage

`/execute-plan <path-to-chunk-file>`

Examples (paths shown use the default plans directory; substitute the configured `plansDir` if different):
- Single-chunk suite: `/execute-plan .claude/plans/2026-04-30-153022-add-rate-limiter/plan.md`
- One chunk in a multi-chunk suite: `/execute-plan .claude/plans/2026-04-30-153022-mqtt-sync/listener.md`

If the user passes the suite directory or `index.md`, ask which chunk they want to run.

## Plans directory

Resolve the plans directory before any path-touching action: read `.claude/plans-config.json` if present and use its `plansDir`; otherwise default to `.claude/plans`. If the config file is missing or malformed, silently fall back to the default. The user-supplied chunk path is authoritative — this resolution only matters when this skill needs to interpret or print paths that aren't given by the user.

## Required tool

This skill requires the `AskUserQuestion` tool. If it is not available, stop immediately and tell the user this skill requires a recent version of Claude Code (run `claude update`).

## Phases

### Phase 1 — Read

Read the chunk file as your **first action**. Do not explore or implement before reading it. If the path is missing, the file doesn't exist, or the file is malformed, stop and tell the user.

Required sections in every chunk file:
- `## Context`
- `## Approach`
- `## Files Changed`
- `## Implementation Steps`
- `## Risks & Edge Cases`
- `## Acceptance Criteria`

Required frontmatter (a block of `> **Field:** value` lines near the top):
- `> **Status:**`
- `> **Depends on:**`
- `> **Part of suite:**`

If any required section or frontmatter line is missing, stop and tell the user the chunk is malformed.

Also read `CLAUDE.md` at the project root for project conventions.

### Phase 1.5 — Suite dependency check

Every chunk belongs to a suite, including single-chunk suites. Always run this phase.

1. Locate the suite index using the `> **Part of suite:**` line. If unset, fall back to `index.md` in the same directory as the chunk.
2. Read the index file.
3. Find this chunk's entry in the index.
4. Check the chunk's current `Status:` field in the index:
   - If `done`: stop. Tell the user this chunk is already marked done. Ask via plain text whether they want to re-run it (which requires manually editing the index back to `pending` first).
   - If `in-progress`: warn the user that the chunk is already in progress (possibly from a previous failed run). Ask via `AskUserQuestion`: "Continue (resume / re-run), or stop?" with options "Continue", "Stop". If continue, proceed.
   - If `blocked`: stop. Tell the user the chunk is marked blocked and needs human resolution before it can run.
   - If `pending`: proceed.
5. Check this chunk's `Depends on:` list. For each dependency, look up its status in the index.
   - If any dependency is not `done`, stop and print:
     ```
     🚫 Cannot execute <chunk-name>: depends on chunks that are not done yet.
        - <dep-name>: <status>
        - <dep-name>: <status>

     Run those chunks first, or use /plan-tracker to see suite status.
     ```
   - End your turn. Do not proceed to implementation.
6. If all dependencies are `done` (or the chunk has no dependencies), mark this chunk's status as `in-progress` in **both** the index file and the chunk file's frontmatter. This is the only automatic status update — it does not claim correctness, only that work has started.

For single-chunk suites this phase is trivially satisfied (`Depends on:` is `(none)`), but the status update from `pending` → `in-progress` still happens.

### Phase 2 — Confirm

Print:

```
📄 Chunk loaded: <filename>
   Suite: <suite-name>
   Status: in-progress (was pending; updated on run start)
   Approach: <one-line from chunk>

   Files to change (in order):
   1. <path> — <intent>
   2. ...

   Acceptance criteria: <count>
```

Then ask in plain text: "Plan looks current and correct? Reply 'go' to proceed, or describe what's stale or wrong."

Stop and wait. Do not proceed to Phase 3 until the user explicitly approves.

If the user reports that the plan is stale (e.g. "the file structure has changed since this was written"), stop. Tell the user the plan should be re-generated with `/deep-plan`. Do not patch a stale plan in execution mode. Revert the chunk's status from `in-progress` back to `pending` in both the index and the chunk file before stopping.

### Phase 3 — Implement

Implement the steps **in the order specified by the chunk**. Do not reorder, skip, or merge steps without explicit user approval.

For each step:
1. Make the change.
2. Verify it builds / parses / passes locally if applicable.
3. Continue to the next step.

If a step is impossible or wrong-as-specified (the plan calls for a file that doesn't exist, specifies an interface that conflicts with reality, etc.), stop and ask the user. Do not silently work around plan specifications.

The chunk provides interfaces, contracts, and intent — not implementation bodies. You are responsible for designing implementations that satisfy the contracts. Use the project's existing patterns (from `CLAUDE.md` and the codebase) as a guide.

### Phase 4 — Verify

After all steps are complete, walk through the acceptance criteria checklist from the chunk. For each criterion:
- Verify it (run the relevant test, check the relevant behavior)
- Mark ✅ or ❌
- For ❌, briefly state why it can't be satisfied as-specified

### Phase 5 — Report

Print a final report:

```
Implementation report

Acceptance criteria:
  ✅ <criterion 1>
  ✅ <criterion 2>
  ❌ <criterion 3> — <reason>

Files changed:
  - <path>

Notes:
  <any deviations from the plan, with reasoning>
```

If any criteria are ❌, do not claim the work is complete.

### Phase 6 — Status prompt

Always prompt the user for the final status — never auto-update from `in-progress` to `done`.

Call `AskUserQuestion`:
- **Question**: "How should this chunk be marked?"
- **Options** (single-select):
  1. "Mark done"
  2. "Mark blocked"
  3. "Leave as in-progress"
  4. "Discard run (revert to pending)"

Update the chunk's status in **both** the suite index file and the chunk file's frontmatter:

- "Mark done" → set status to `done` in both files. Print: "✅ Chunk <name> marked done in suite index."
- "Mark blocked" → set status to `blocked` in both files. Print: "⚠️ Chunk <name> marked blocked. Other chunks depending on this one cannot run until resolved."
- "Leave as in-progress" → no change (already `in-progress`). Print: "ℹ️ Status left as in-progress."
- "Discard run" → set status back to `pending` in both files. Print: "↩️ Status reverted to pending. (Code changes were NOT reverted — use git to undo if needed.)"

End your turn after printing the acknowledgment.

## Constraints

- Read the chunk first, before any other action.
- Always check suite dependencies — even for single-chunk suites (the status transition still applies).
- Refuse to run if dependencies aren't done.
- Implement steps in the order specified.
- Don't deviate from the plan silently — ask the user when reality and the plan diverge.
- Don't claim completion when acceptance criteria are not met.
- Never auto-mark a chunk as `done`. Always prompt the user.
- The only automatic status update is `pending` → `in-progress` at run start.
- Status must always be kept in sync between the index and the chunk file frontmatter.