---
name: plan-tracker
description: Read-only status view for plan suites in the current project. Detects the active suite (one with chunks not yet done) and shows status, dependencies, and what's runnable next. Use when the user invokes /plan-tracker or asks "what's the state of the plan" / "what's next in the plan" / "what's left".
---

# /plan-tracker

Show the current state of plan suites in this project. **Read-only** — this skill never modifies any plan file.

Every plan produced by `/deep-plan` is a suite (a directory containing `index.md` and one or more chunk files), including single-chunk plans. This tracker operates on every such suite uniformly.

## Operating mode

This skill is **strictly read-only**. Do not use `Edit`, `Write`, `MultiEdit`, or any `Bash` command that modifies files or repository state. Use `Read`, `Glob`, `Grep`, and read-only `Bash` (`ls`, `find`, `cat`) only.

## Required tool

This skill requires the `AskUserQuestion` tool. If it is not available, stop immediately and tell the user this skill requires a recent version of Claude Code (run `claude update`).

## Phases

### Phase 1 — Discover suites

Look for plan suites in `.claude/plans/`. A suite is a subdirectory containing an `index.md` file.

Run roughly: `find .claude/plans -name index.md -type f`

For each suite found, parse its index to determine:
- Suite name (from the `# Suite: <name>` heading)
- Goal (from the `## Goal` section)
- Chunk list with name, status, dependencies (from the `## Chunks` section)

If a bare `.md` file exists directly under `.claude/plans/` (not inside a suite directory), it's a legacy single-plan from before the suite-everywhere refactor. Note it under "Legacy plans (untracked)" but do not parse it. Suggest the user re-run `/deep-plan` if they want to track it.

If no suites exist, print:
```
No plan suites found in .claude/plans/.

Use /deep-plan to create a new plan.
```
End your turn.

### Phase 2 — Identify active suite

A suite is **active** if at least one of its chunks has status `pending`, `in-progress`, or `blocked`.

A suite is **complete** if all chunks are `done`.

Identify active suites and complete suites separately.

#### If exactly one active suite

Default to it. Skip to Phase 3.

#### If multiple active suites

Call `AskUserQuestion`:
- **Question**: "Which suite would you like to track?"
- **Options** (single-select, up to 4): list each active suite by name. If more than 4, list the 3 most recently modified plus a 4th option "List all suites".

If user picks "List all suites", print all active suites with their last-modified time, then ask in plain text: "Which suite? (paste the name or path)".

Once a suite is selected, proceed to Phase 3.

#### If zero active suites but one or more complete suites

Print:
```
No active suites. Completed suites:
  - <suite-name> (all <N> chunks done)
  - ...
```

Ask via `AskUserQuestion`: "View a completed suite, or stop?" with options "View completed suite", "Stop". If view, list completed suites and let user pick.

### Phase 3 — Display suite status

Print a clear, scannable status view:

```
📋 Suite: <Suite name>
   Goal: <goal>
   Path: <suite-directory>

Chunks:
  ✅ <chunk-name>           done
  🟡 <chunk-name>           in-progress     (started: <relative time, e.g. "2h ago" if inferable from file mtime>)
  ⏸️  <chunk-name>          blocked         (depends on: <deps>)
  ⏳ <chunk-name>           pending         (depends on: <deps>)
  ⏳ <chunk-name>           pending         (no dependencies — runnable now)

Progress: <done>/<total> chunks done

Runnable now (no blockers):
  - <chunk-name>: claude "/execute-plan <path>"
  - <chunk-name>: claude "/execute-plan <path>"

Blocked (waiting on dependencies):
  - <chunk-name>: depends on <chunk-name> (status: <status>)
```

Status icons:
- ✅ done
- 🟡 in-progress
- ⏸️ blocked
- ⏳ pending

A chunk is **runnable** if its status is `pending` and all its dependencies have status `done`.

A chunk is shown as **blocked** in the runnable section if its status is `pending` but a dependency is not `done`. (This is distinct from a chunk explicitly marked `blocked` — that one needs human resolution, not just waiting.)

If the user has multiple runnable chunks, list them all. Do not pick one for them.

### Phase 4 — Optional next step

After displaying status, end your turn. Do not call any further tools, do not modify any files, do not suggest concrete actions beyond the runnable commands already printed.

If the user wants to act, they will run `/execute-plan <path>` themselves. The tracker's job is to inform, not to drive.

## Constraints

- Strictly read-only. No file modifications under any circumstance.
- Only operates on suites (directories with `index.md`). Single plans are not tracked.
- Always end after Phase 4. Do not chain into `/execute-plan` or any action.
- If the index file is malformed (missing required sections, unparseable status), report the malformation rather than guessing.
