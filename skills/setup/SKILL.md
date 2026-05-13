---
name: setup
description: Configure where plan suites live and whether the plans directory is gitignored. Writes `.claude/plans-config.json` with `plansDir` (default `.claude/plans`) and `gitignore` (default `true`) keys. Existing planning skills (`/intake`, `/deep-plan`, `/simple-plan`, `/plan-tracker`, `/execute-plan`, `/review-plan`) read this config to resolve the plans directory, falling back to `.claude/plans` when the config is absent. Use when the user invokes `/setup`, asks to "configure the plans directory", "change where plans live", "set up the plans skill config", or wants to opt in/out of gitignoring the plans directory.
---

# /setup

Write a small JSON config that the planning skills consult to find the plans directory and decide whether to manage `.gitignore`. This skill writes at most two files: `.claude/plans-config.json` and (optionally) `.gitignore`.

## Required tool

This skill requires the `AskUserQuestion` tool. If it is not available, stop immediately and tell the user this skill requires a recent version of Claude Code (run `claude update`).

## Operating mode

- **Two writes max.** `.claude/plans-config.json` and (only if needed) an append to `.gitignore`. No other writes.
- **Read-only on code.** This skill does not touch any source file.
- **Non-destructive on `.gitignore`.** Never remove or rewrite existing `.gitignore` lines. Only append when missing.
- **Defaults are the historical path.** `plansDir` defaults to `.claude/plans`; `gitignore` defaults to `true`. Users who never run `/setup` get the same behavior as before.

## Config file contract

`.claude/plans-config.json`:

```json
{
  "plansDir": ".claude/plans",
  "gitignore": true
}
```

- `plansDir`: string, relative or absolute path. Default `.claude/plans`. Absolute paths are allowed (some users keep plans outside the repo).
- `gitignore`: boolean. If `true`, skills ensure `plansDir` is in `.gitignore`. If `false`, skills do not touch `.gitignore`.

## Phases

### Phase 1 — Detect existing config

Read `.claude/plans-config.json` if it exists. If present:

1. Show the current values.
2. Ask via `AskUserQuestion`: "Config already exists. Reconfigure or keep as-is?" with options "Keep" (Recommended) and "Reconfigure".
3. If "Keep", end the turn after printing the current config.
4. If "Reconfigure", proceed to Phase 2.

If `.claude/plans-config.json` does not exist, proceed to Phase 2.

### Phase 2 — Q&A

Ask two questions via `AskUserQuestion`, one at a time, recommended-answer option first.

1. **Plans directory.** Options: `.claude/plans` (Recommended), `Other` (user types a path). Accept absolute or relative paths.
2. **Gitignore the plans directory?** Options: `Yes` (Recommended), `No`.

### Phase 3 — Write config

1. Create `.claude/` if it does not exist.
2. Write `.claude/plans-config.json` with the chosen `plansDir` and `gitignore` values.
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

<gitignore note if applicable>
```

End the turn.

## Constraints

- Never write outside `.claude/plans-config.json` and `.gitignore`.
- Never remove existing `.gitignore` lines.
- Defaults must match the historical behavior (`.claude/plans`, gitignored).
- Ask questions via `AskUserQuestion`; one question at a time; recommended-answer option first.
