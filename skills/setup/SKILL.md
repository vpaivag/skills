---
name: setup
description: Configure where plan suites live, whether the plans directory is gitignored, and whether old suites are pruned. Writes `.claude/plans-config.json` with `plansDir` (default `.claude/plans`), `gitignore` (default `true`), and optional `retainDays` (default: keep forever) keys. The planning skills (`/blueprint`, `/build`, `/qa`) read this config to resolve the plans directory, falling back to `.claude/plans` when the config is absent. Use when the user invokes `/setup`, asks to "configure the plans directory", "change where plans live", "set up the plans skill config", wants to opt in/out of gitignoring the plans directory, or wants old plans deleted automatically after some number of days.
---

# /setup

Write a small JSON config that the planning skills consult to find the plans directory, decide whether to manage `.gitignore`, and decide whether to prune old suites. This skill writes at most two files: `.claude/plans-config.json` and (optionally) `.gitignore`.

## Asking questions

This skill prefers the `AskUserQuestion` tool for interactive prompts. If `AskUserQuestion` is not available (older Claude Code versions, restricted environments), fall back to plain text: print the question, list the options as a numbered list with the recommended option marked `(Recommended)`, and wait for the user's reply (a number or the option label). The skill proceeds normally in either mode — every call site below that says "call `AskUserQuestion`" follows this fallback rule.

## Operating mode

- **Two writes max.** `.claude/plans-config.json` and (only if needed) an append to `.gitignore`. No other writes.
- **Read-only on code.** This skill does not touch any source file.
- **Non-destructive on `.gitignore`.** Never remove or rewrite existing `.gitignore` lines. Only append when missing.
- **Defaults are the historical path.** `plansDir` defaults to `.claude/plans`; `gitignore` defaults to `true`; `retainDays` is absent, so nothing is ever pruned. Users who never run `/setup` get the same behavior as before.

## Config file contract

`.claude/plans-config.json`:

```json
{
  "plansDir": ".claude/plans",
  "gitignore": true,
  "retainDays": 30
}
```

- `plansDir`: string, relative or absolute path. Default `.claude/plans`. Relative paths resolve against the **project root** (the repository), never the user's home `~/.claude/`. Absolute paths are allowed (some users keep plans outside the repo).
- `gitignore`: boolean. If `true`, skills ensure `plansDir` is in `.gitignore`. If `false`, skills do not touch `.gitignore`.
- `retainDays`: optional positive integer. When set, the plugin's `SessionStart` hook (`hooks/prune-plans.sh`) deletes suites whose timestamped directory name is older than this many days every time a Claude Code session starts in the repo — never a suite with files tracked in git. The hook ships with the plugin install only; a skills-CLI install records the key but nothing prunes. Omit it to keep suites forever (the default). This skill writes the key only when the user picks a number.

## Phases

### Phase 1 — Detect existing config

Read `.claude/plans-config.json` if it exists. If present:

1. Show the current values.
2. Ask via `AskUserQuestion`: "Config already exists. Reconfigure or keep as-is?" with options "Keep" (Recommended) and "Reconfigure".
3. If "Keep", end the turn after printing the current config.
4. If "Reconfigure", proceed to Phase 2.

If `.claude/plans-config.json` does not exist, proceed to Phase 2.

### Phase 2 — Q&A

Ask three questions via `AskUserQuestion`, one at a time, recommended-answer option first.

1. **Plans directory.** Options: `.claude/plans` (Recommended), `Other` (user types a path). Accept absolute or relative paths.
2. **Gitignore the plans directory?** Options: `Yes` (Recommended), `No`.
3. **Delete old plans automatically?** "Old suites can be deleted automatically when a Claude Code session starts, once they are older than N days. Suites tracked in git are never deleted." Options: `Keep forever` (Recommended), `30 days`, `7 days`, `Other` (user types a number of days). Reject anything that isn't a positive integer and re-ask.

### Phase 3 — Write config

1. Create `.claude/` if it does not exist.
2. Write `.claude/plans-config.json` with the chosen `plansDir` and `gitignore` values, plus `retainDays` only if the user picked a number of days.
3. If `gitignore: true`:
   - If a `.gitignore` exists at the project root and does not already contain a line matching `plansDir` (with optional trailing `/`), append `<plansDir>/` to it.
   - If `.gitignore` does not exist, create it with that single line.
4. If `gitignore: false`:
   - Do **not** modify `.gitignore`.
   - If `.gitignore` exists and already contains a line matching `plansDir`, print a note: "Your `.gitignore` still contains `<plansDir>`. Remove it manually if you want plans tracked in git."

### Phase 4 — Confirm

Print a summary:

```
✅ Config written: .claude/plans-config.json
   plansDir: <value>
   gitignore: <true|false>
   retainDays: <n — suites older than n days are pruned at session start | keep forever>

<gitignore note if applicable>
```

End the turn.

## Constraints

- Never write outside `.claude/plans-config.json` and `.gitignore`.
- Never remove existing `.gitignore` lines.
- Defaults must match the historical behavior (`.claude/plans`, gitignored, nothing pruned).
- This skill never deletes suites itself — it only records `retainDays`; the `SessionStart` hook does the pruning.
- Ask questions via `AskUserQuestion`; one question at a time; recommended-answer option first.
