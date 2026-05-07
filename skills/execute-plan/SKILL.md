---
name: execute-plan
description: Execute a plan file produced by /deep-plan. Reads the specified plan, confirms files and order with the user, implements in sequence, and verifies each acceptance criterion. For chunks in a suite, checks dependencies in the suite index before running, and prompts the user to update status at the end. Use when the user invokes /execute-plan <path>.
---

# /execute-plan

Implement the plan at the path provided by the user. The plan is self-contained — you should not need information outside the plan file and the codebase itself.

## Usage

`/execute-plan <path-to-plan-file>`

Examples:
- Single plan: `/execute-plan .claude/plans/2026-04-30-153022-add-rate-limiter.md`
- Chunk in a suite: `/execute-plan .claude/plans/2026-04-30-153022-mqtt-sync/listener.md`

## Required tool

This skill requires the `AskUserQuestion` tool. If it is not available, stop immediately and tell the user this skill requires a recent version of Claude Code (run `claude update`).

## Phases

### Phase 1 — Read

Read the plan file as your **first action**. Do not explore or implement before reading it. If the path is missing, the file doesn't exist, or the file is malformed (missing required sections), stop and tell the user.

Required sections in every plan file:
- `## Context`
- `## Approach`
- `## Files Changed`
- `## Implementation Steps`
- `## Risks & Edge Cases`
- `## Acceptance Criteria`

If the file has a `> **Status:**` line near the top, this is a chunk in a suite. Continue to Phase 1.5.

If there is no status line, this is a standalone single plan. Skip to Phase 2.

Also read `CLAUDE.md` at the project root for project conventions.

### Phase 1.5 — Suite dependency check (chunks only)

If this is a chunk in a suite:

1. Locate the suite index file. The chunk's frontmatter should reference it via `> **Part of suite:** <path>`. If not, infer it: look for `index.md` in the same directory as the chunk file.
2. Read the index file.
3. Find this chunk's entry in the index.
4. Check the chunk's current `Status:` field in the index:
   - If `done`: stop. Tell the user this chunk is already marked done. Ask via plain text whether they want to re-run it (which requires manually editing the index back to `pending` first).
   - If `in-progress`: warn the user that the chunk is already in progress (possibly from a previous failed run). Ask via `AskUserQuestion`: "Continue (resume / re-run), or stop?" with options "Continue", "Stop". If continue, proceed.
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
6. If all dependencies are `done`, mark this chunk's status as `in-progress` in the index file (and in the chunk file's frontmatter). This is the only automatic status update — it does not claim correctness, only that work has started.

### Phase 2 — Confirm

Print:

```
📄 Plan loaded: <filename>
   Approach: <one-line from plan>

   Files to change (in order):
   1. <path> — <intent>
   2. ...

   Acceptance criteria: <count>
```

For chunks, also print:
```
   Suite: <suite-name>
   Status: in-progress (was pending; updated on run start)
```

Then ask in plain text: "Plan looks current and correct? Reply 'go' to proceed, or describe what's stale or wrong."

Stop and wait. Do not proceed to Phase 3 until the user explicitly approves.

If the user reports that the plan is stale (e.g. "the file structure has changed since this was written"), stop. Tell the user the plan should be re-generated with `/deep-plan`. Do not patch a stale plan in execution mode. (For chunks: also revert the chunk's status from `in-progress` back to `pending` in the index before stopping.)

### Phase 3 — Implement

Implement the steps **in the order specified by the plan**. Do not reorder, skip, or merge steps without explicit user approval.

For each step:
1. Make the change.
2. Verify it builds / parses / passes locally if applicable.
3. Continue to the next step.

If a step is impossible or wrong-as-specified (the plan calls for a file that doesn't exist, specifies an interface that conflicts with reality, etc.), stop and ask the user. Do not silently work around plan specifications.

The plan provides interfaces, contracts, and intent — not implementation bodies. You are responsible for designing implementations that satisfy the contracts. Use the project's existing patterns (from `CLAUDE.md` and the codebase) as a guide.

### Phase 4 — Verify

After all steps are complete, walk through the acceptance criteria checklist from the plan. For each criterion:
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
- **Question**: "How should this <plan|chunk> be marked?"
- **Options** (single-select):
  1. "Mark done"
  2. "Mark blocked"
  3. "Leave as in-progress"
  4. "Discard run (revert to pending)"

#### For single plans (no suite)

Single plans don't track status, but still show this prompt for symmetry with chunks. The user's choice is informational — print a brief acknowledgment and end your turn:

- "Mark done" → "✅ Plan complete. (No status tracking for single plans.)"
- "Mark blocked" → "⚠️ Plan blocked. Consider running /deep-plan again with new information."
- "Leave as in-progress" → "ℹ️ Acknowledged. No state changes."
- "Discard run" → "↩️ Acknowledged. No state changes. (To revert code changes, use git.)"

#### For chunks in a suite

Update the chunk's status in **both** the suite index file and the chunk file's frontmatter:

- "Mark done" → set status to `done` in both files. Print: "✅ Chunk <name> marked done in suite index."
- "Mark blocked" → set status to `blocked` in both files. Print: "⚠️ Chunk <name> marked blocked. Other chunks depending on this one cannot run until resolved."
- "Leave as in-progress" → no change (already `in-progress`). Print: "ℹ️ Status left as in-progress."
- "Discard run" → set status back to `pending` in both files. Print: "↩️ Status reverted to pending. (Code changes were NOT reverted — use git to undo if needed.)"

End your turn after printing the acknowledgment.

## Constraints

- Read the plan first, before any other action.
- For chunks: check dependencies before implementing. Refuse to run if dependencies aren't done.
- Implement steps in the order specified.
- Don't deviate from the plan silently — ask the user when reality and the plan diverge.
- Don't claim completion when acceptance criteria are not met.
- Never auto-mark a chunk as `done`. Always prompt the user.
- The only automatic status update is `pending` → `in-progress` at run start.
