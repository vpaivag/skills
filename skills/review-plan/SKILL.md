---
name: review-plan
description: Read-only audit of a finished (or near-finished) plan suite. Compares the suite's index.md goal and per-chunk acceptance criteria against the actual git diff since the suite was created, and reports goal alignment, coverage gaps, drift (changes not traceable to any chunk), and status-sanity issues (chunks marked done whose criteria don't appear satisfied). Use when the user invokes /review-plan, or asks "is the plan actually done?", "did we deliver what the plan promised?", "is the suite status honest?", or wants a final check before declaring a plan suite complete.
---

# /review-plan

Audit a plan suite produced by `/deep-plan` against the work that's actually landed in the codebase. Answer: **did the diff deliver what the plan promised, and is the suite's recorded status honest?**

`plan-tracker` shows what the suite *says*. `review-plan` checks whether the suite is *telling the truth*.

## Operating mode

**Strictly read-only.** Use only `Read`, `Glob`, `Grep`, and read-only `Bash` (`ls`, `find`, `cat`, `git log`, `git diff`, `git show`, `git status`). Never edit the suite, the chunk files, or the code. Never update statuses or commit. The output is one report printed to the conversation.

## Usage

`/review-plan` (with optional path to a suite directory or `index.md`).

A *suite* is any directory under `.claude/plans/` containing an `index.md`. Single-chunk suites are reviewed identically to multi-chunk ones.

If no path is given, discover suites under `.claude/plans/` and use the only one. If multiple, call `AskUserQuestion` with up to 4 most-recently-modified suites. If `AskUserQuestion` is unavailable, stop and ask the user to run `claude update`.

## Phases

### Phase 1 — Read the suite

Read `index.md` (suite name, goal, chunk table) and every chunk file it references (frontmatter status, `Files Changed`, `Acceptance Criteria`).

If the index lists a chunk file that doesn't exist, or a chunk file is malformed (missing required sections per `PLAN-FORMAT.md`), record it as a **structural** finding and continue — don't bail.

If the index status and the chunk-frontmatter status disagree for any chunk, flag it as a status-sanity issue.

### Phase 2 — Determine the diff baseline

Try in order, and state which one you used in the report:

1. **Creation commit.** `git log --diff-filter=A --follow --format=%H -- <suite>/index.md | tail -1`. Use that commit's parent as baseline. If `index.md` is uncommitted, baseline is `HEAD` and include uncommitted state via `git status --porcelain` + `git diff`.
2. **Timestamp fallback.** If git log is empty, parse the suite directory's `YYYY-MM-DD-HHMMSS-...` prefix and use `git rev-list -1 --before="<timestamp>" HEAD`.
3. **No git repo.** Stop and tell the user this skill needs git history; suggest manual chunk-by-chunk verification instead.

Collect the file list with `git diff --name-status <baseline>..HEAD`. Read targeted hunks (`git diff <baseline>..HEAD -- <path>`) when verifying a specific criterion — don't dump the whole diff into context.

Exclude the suite directory itself (`.claude/plans/<suite>/**`) from the drift bucket — suite metadata isn't deliverable code.

### Phase 3 — Cross-check

Build four findings buckets.

**A. Goal alignment.** Read the suite goal. Look at the shape of the diff (which directories, which subsystems). In 2–4 sentences: does the diff plausibly deliver the goal? Be specific — cite files. Note anything the goal implies that you can't see.

**B. Coverage.** For each chunk, walk its `Files Changed` and `Acceptance Criteria`:
- Is each declared file in the diff?
- Is each criterion plausibly satisfied? Spot-check the relevant hunks. If a criterion specifies an interface (function, type, schema field, route, env var), grep for it.

You're not running tests. If a criterion needs runtime verification ("deploys cleanly to staging"), mark it **unverifiable from diff**.

**C. Drift.** For each non-suite file in the diff, ask which chunk's `Files Changed` covers it. If none, group as **plausibly related** (incidental cleanup tied to a chunk) or **unrelated / scope creep**. When in doubt, list it and let the user judge — drift is observation, not accusation.

**D. Status sanity.** For each chunk:
- Recorded `done` → criteria plausibly satisfied and files changed? If not, flag.
- Recorded `pending`/`in-progress` → diff already contains its files / satisfies its criteria? If yes, the recorded status lags reality — flag.
- Recorded `blocked` → note it; not necessarily an issue.
- Index vs. chunk-frontmatter mismatch → flag (from Phase 1).

### Phase 4 — Report

Print one report:

```
🔎 Plan review: <suite-name>
   Path: <suite-dir>
   Baseline: <ref> (<reason: creation commit | timestamp fallback | uncommitted>)
   Diff: <N> files changed, excluding suite dir
   Recorded status: <done>/<total> chunks done

## Goal alignment
<2–4 sentences citing specific files.>
Verdict: ✅ aligned | ⚠️ partial | ❌ off-target

## Coverage gaps
- [chunk-name] <criterion or expected file> — <why missing or unverifiable>
<Or: "All criteria appear satisfied by the diff." if clean.>

## Drift
Plausibly related:
- <path>: <one-line> — likely tied to <chunk-name>

Unrelated / scope creep:
- <path>: <one-line> — no chunk claims this

<Omit either subsection if empty. "No drift detected." if both empty.>

## Status sanity
- <chunk-name>: recorded <status>, but <observation> → suggest <status>
<Or: "All recorded statuses match reality.">

## Structural issues
<Malformed chunks, missing files, index/frontmatter mismatches. Omit if none.>

## Bottom line
<1–3 sentences. Is this suite actually done? Smallest set of follow-ups before it can be honestly closed?>
```

End your turn after printing. Do not offer to fix anything, update statuses, or suggest commits — the user owns those decisions.

## Why each rule exists

- **Empty buckets are good.** Don't pad. If coverage is clean, say so in one line.
- **Every finding cites a chunk, file, or criterion.** "Looks incomplete" is not a finding.
- **State the baseline explicitly.** A wrong comparison window invalidates the whole report; the user needs to sanity-check it.
- **Mark runtime-only criteria unverifiable.** Don't pretend a code read can confirm "deploys cleanly".
