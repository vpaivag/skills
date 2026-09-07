---
name: scrap
description: Delete an existing plan suite and clear the way to start from zero. Lists suites under the configured plans directory (or accepts a path/slug argument), shows what each one is (context/plan/qa/review status), confirms the destructive delete explicitly, then removes the suite directory. Never edits code, never touches other suites, never auto-starts a new /blueprint. Use when the user invokes /scrap, asks to "scrap the plan", "throw out this plan and start over", "delete the plan suite", "start from scratch", or wants to abandon an in-progress or approved plan without keeping any of it.
---

# /scrap

Delete one plan suite (the directory `/blueprint` created: `context.md`, `plan.md`, `qa-plan.md`, `visual.html`, optionally `review.json`) so the user can start over with a clean slate. This skill only deletes — it never edits plan content, never touches sibling suites, and never re-invokes `/blueprint` on its own.

## Asking questions

This skill prefers the `AskUserQuestion` tool for interactive prompts. If `AskUserQuestion` is not available, fall back to plain text: print the question, list the options as a numbered list with the recommended option marked `(Recommended)`, and wait for the user's reply. Every call site below that says "call `AskUserQuestion`" follows this fallback rule.

## Plans directory

Resolve the plans directory before touching anything: read `.claude/plans-config.json` **at the project root** if present and use its `plansDir`; otherwise default to `.claude/plans` **relative to the project root**. Never resolve against the user's home directory. If the config file is missing or malformed, silently fall back to the default.

## Operating mode

- **Deletion is the only write.** This skill's sole filesystem mutation is `rm -rf <one-suite-dir>`. It never edits `.gitignore`, never edits any file inside a suite, never touches a suite other than the one confirmed.
- **Never guess which suite.** If more than one suite exists and the invocation didn't disambiguate, ask — do not delete the most-recent or most-active one by assumption.
- **Confirm before deleting, always.** This is a destructive, hard-to-reverse action (no trash, no undo other than git if the suite happened to be committed). Always get an explicit `AskUserQuestion` confirmation naming the exact path, even when the user's invocation already sounds decisive ("scrap the login plan").
- **Do not auto-invoke `/blueprint`.** Offer the next step as a command to run, per the same handoff convention as `/blueprint`'s own stage 9 — starting fresh is the user's call to make in their own turn.

## Phases

### Phase 1 — Resolve target suite

1. Resolve `<plansDir>` per above. If it does not exist or contains no suite directories, print `No plan suites found under <plansDir>.` and end the turn — nothing to scrap.
2. If `/scrap` was invoked with an argument (a path or a slug fragment), resolve it against `<plansDir>`:
   - An exact or suffix match on a directory name (e.g. `2026-09-01-add-auth` or just `add-auth`) selects that suite.
   - No match: print `No suite under <plansDir> matches "<arg>".` and list the actual suite directory names, then end the turn.
   - Ambiguous match (more than one directory contains the fragment): fall through to Phase 2's disambiguation, scoped to just the matches.
3. If no argument was given, list every suite directory directly under `<plansDir>` (one level deep, each named `<timestamp>-<slug>`).

### Phase 2 — Identify and disambiguate

For each candidate suite, read only file *presence* (not content) to build a one-line status:

- `context.md` missing → `empty/incomplete`
- `context.md` present, `plan.md` missing → `context only`
- `plan.md` present, `review.json` missing → `plan drafted, not reviewed`
- `review.json` present → read its verdict field if present and show it (e.g. `approved`, `flagged`) — otherwise just `reviewed`

If exactly one suite is in play (single match from an argument, or only one suite exists total), skip straight to Phase 3 with that suite.

Otherwise, call `AskUserQuestion`: "Which plan suite do you want to scrap?" with one option per suite (label = the directory name, description = the one-line status above, newest suite first) plus an implicit way out — if the tool requires explicit options, add a final "Cancel" option. On Cancel, end the turn without touching anything.

### Phase 3 — Confirm the delete

Print the suite's contents (`ls <suite-dir>`) so the user sees exactly what's about to go, then call `AskUserQuestion`:

"Delete `<suite-dir>` and everything in it? This can't be undone unless it's committed to git." with options:
- "Delete (Recommended)" — proceed to Phase 4
- "Cancel" — end the turn, nothing deleted

Never skip this confirmation, even for a suite that looks empty or clearly abandoned.

### Phase 4 — Delete

1. Run `git status --short <suite-dir>` first. If it shows tracked, uncommitted changes inside the suite, surface that to the user in the confirmation text of Phase 3 before proceeding (re-ask if you didn't already know this) — the point is the user should know if they're discarding tracked work, not just an untracked scratch dir.
2. Run `rm -rf <suite-dir>`.
3. Confirm: `Scrapped: <suite-dir>`.

### Phase 5 — Offer a fresh start

Ask via `AskUserQuestion`: "Start a new /blueprint from scratch now?" with options "Not now (Recommended)" and "Yes, show me the command". On the latter, print:

```
claude "/blueprint <describe the task>"
```

Do not run it yourself. End the turn either way.

## Constraints

- Only ever delete one suite directory per invocation, and only the one explicitly confirmed in Phase 3.
- Never delete or modify `plansDir` itself, `.claude/plans-config.json`, or `.gitignore`.
- Never delete a suite without an explicit `AskUserQuestion` confirmation naming its exact path.
- Never auto-invoke `/blueprint`, `/build`, or `/qa`.
