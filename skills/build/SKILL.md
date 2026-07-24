---
name: build
description: Execute a plan.md produced by /plan. Reads the plan, confirms with the user, implements the phases in order, verifies each mechanical acceptance criterion (AC-n), and ends with the /qa handoff. Run it in a fresh session with `claude --model sonnet "/build <path>"`. Use when the user invokes /build <path>.
---

# /build

Implement the plan at the path provided by the user. Every suite produced by `/blueprint` contains exactly one `plan.md` — there are no chunks, no index, and no status files.

## Usage

`/build <suite-dir>` or `/build <suite-dir>/plan.md`

If given the suite dir, the plan is `plan.md` inside it. Suite paths are relative to the project root (the repository), never the user's home `~/.claude/`. This skill is designed to run in a fresh session on Sonnet — `/blueprint` prints the exact command (`claude --model sonnet "/build …"`); planning quality was already paid for upstream, execution follows the contract.

## Asking questions

This skill prefers the `AskUserQuestion` tool for interactive prompts. If `AskUserQuestion` is not available (older Claude Code versions, restricted environments), fall back to plain text: print the question, list the options as a numbered list with the recommended option marked `(Recommended)`, and wait for the user's reply (a number or the option label). The skill proceeds normally in either mode.

## Phases

### Phase 1 — Read

Read `plan.md` as your **first action**. Do not explore or implement before reading it. If the path is missing, the file doesn't exist, or the file is malformed, stop and tell the user.

Required in every plan file (per `skills/blueprint/PLAN-FORMAT.md`):

- YAML frontmatter with `artifact: plan`, `title`, `path`, `context`, `created`
- `## Context`, `## Approach`, `## Files changed`, `## Phases`, `## Risks & edge cases`, `## Acceptance criteria`

If any required section or frontmatter key is missing, stop and tell the user the plan is malformed.

Also read `CLAUDE.md` at the project root for project conventions. Do **not** read `qa-plan.md` — behavioral verification belongs to a separate, unbiased session.

### Phase 2 — Confirm

Print:

```
Plan loaded: <path>
  Approach: <one-line from plan>
  Phases: <count> — <names>
  Files to change: <count>
  Acceptance criteria: <count>
```

Then ask in plain text: "Plan looks current and correct? Reply 'go' to proceed, or describe what's stale or wrong."

Stop and wait. Do not proceed until the user explicitly approves.

If the user reports that the plan is stale (e.g. "the file structure has changed since this was written"), stop. Tell the user the plan should be revised with `/blueprint` — do not patch a stale plan in execution mode.

### Phase 3 — Implement

Implement the plan's phases **in order**, and within each phase the steps in order. Do not reorder, skip, or merge without explicit user approval.

At each phase boundary, print a one-line checkpoint (`Phase 1 — <name>: done, builds clean`) and continue — phases are pacing, not stopping points, unless a step failed.

For each step:
1. Make the change.
2. Verify it builds / parses / passes locally if applicable.
3. Continue to the next step.

If a step is impossible or wrong-as-specified (the plan calls for a file that doesn't exist, specifies an interface that conflicts with reality, etc.), stop and ask the user. Do not silently work around plan specifications.

The plan provides interfaces, contracts, and intent — not implementation bodies. You are responsible for designing implementations that satisfy the contracts. Use the project's existing patterns (from `CLAUDE.md` and the codebase) as a guide.

### Phase 4 — Verify

After all phases are complete, walk through the `AC-n` checklist from the plan. For each criterion:
- Verify it (run the relevant check, observe the relevant behavior)
- Mark ✅ or ❌
- For ❌, briefly state why it can't be satisfied as-specified

These are the plan's **mechanical** criteria only. Do not attempt behavioral verification here — that is `/qa`'s job, and doing it in this session would mean grading your own homework.

### Phase 5 — Report & handoff

Print:

```
Implementation report

Acceptance criteria:
  AC-1 ✅ <criterion>
  AC-2 ❌ <criterion> — <reason>

Files changed:
  - <path>

Notes:
  <any deviations from the plan, with reasoning>

Next — behavioral QA, in a fresh session (this session is biased by its own implementation):
  claude --model sonnet "/qa <suite-dir>"
```

If any criteria are ❌, do not claim the work is complete. Do not commit — leave that to the user. End your turn.

## Constraints

- Read the plan first, before any other action.
- Never read `qa-plan.md` or run behavioral QA in this session.
- Implement phases and steps in the order specified.
- Don't deviate from the plan silently — ask the user when reality and the plan diverge.
- Don't claim completion when acceptance criteria are not met.
- Do not update `plan.md` — it is a planning artifact, not a tracker; use git to see what changed.
- Do not commit.
