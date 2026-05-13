---
name: simple-plan
description: Lightweight planner for straightforward, mechanical tasks where no architectural decision is involved — single-file bugfixes, renames, flag additions, small refactors confined to one or two files. Runs a compressed flow (restate → brief explore → specify → risk & verify → persist) and writes a single `simple-plan.md` file into a new or adopted suite directory under the configured plans directory (default `.claude/plans/`). When invoked on a suite dir that already contains a `context.md` (typically from `/intake`), reads it and writes output into the same dir; otherwise mints a fresh suite dir. Does NOT integrate with `/execute-plan` or `/plan-tracker`; the user implements the plan directly. Use when the user invokes /simple-plan, when `/intake` recommended `/simple-plan` (no ADR-gate criterion fired), or when the user asks for a quick/lightweight plan for a small task.
---

# /simple-plan

A compressed planner for tasks where the work is mostly mechanical and no architectural decision is involved. Produces a **single markdown file** (`simple-plan.md`) and — if the user approves — implements it in the same session. No `/execute-plan` handoff, no chunk decomposition, no `index.md`. The handoff is skipped because Phase 2 exploration is tight enough (1–3 files) that running the work in-session doesn't bloat context.

If the task turns out to involve real tradeoffs, touch many files, or branch into multiple viable approaches, this skill **stops and recommends `/deep-plan`** rather than producing a half-baked simple plan.

## Required tool

This skill requires the `AskUserQuestion` tool. If it is not available, stop immediately and tell the user this skill requires a recent version of Claude Code (run `claude update`).

## Plans directory

Resolve the plans directory before any path-touching action: read `.claude/plans-config.json` if present and use its `plansDir`; otherwise default to `.claude/plans`. The config also carries a `gitignore` boolean (default `true`) — only manage `.gitignore` when that flag is true. If the config file is missing or malformed, silently fall back to the defaults. Everywhere this skill says "the plans directory" or `<plansDir>` below, it means the resolved value.

## Operating mode

- **Read-only on code during planning.** Use `Read`, `Glob`, `Grep` only on the 1–3 files the change is likely to touch. No broad codebase mapping — that's what `/deep-plan` is for.
- **One write.** You may write exactly one file (`simple-plan.md`) inside one new or adopted directory under the plans directory, and may append the plans directory to `.gitignore` if not already present (only when the config's `gitignore` flag is true). No other writes during planning.
- **Do not invoke `/execute-plan`, `/deep-plan`, `/intake`, or any other skill.** This skill owns its own flow end-to-end. If the bailout rule fires, you *recommend* `/deep-plan` — you do not call it.

## Phases

Execute these phases in order. Do not skip ahead.

### Phase 0 — Adopt or mint

Decide whether to **adopt** an existing suite directory that already contains a `context.md` (typically written by `/intake`) or **mint** a fresh one in Phase 5.

1. **Detect.** Adopt if either:
   - Invoked with an argument that is an existing directory under the plans directory containing a `context.md`, **or**
   - Invoked with no argument and exactly one directory under the plans directory contains a `context.md`, no `index.md`, and no `simple-plan.md`.
2. **On adopt:**
   - Read `context.md` before any other action.
   - Print `📥 Adopted intake context from <path>/context.md` at the top of your first response.
   - Use the adopted dir as the suite dir; outputs go there.
   - If `context.md`'s `Recommended planner:` is `/deep-plan` but the user invoked `/simple-plan` anyway, print:
     ```
     Note: /intake recommended /deep-plan (because: <reason from context.md>). Proceeding with /simple-plan as you chose.
     ```
3. **On no adoption:** mint a new dir.
   - Compute timestamp via `date +%Y-%m-%d-%H%M%S`.
   - Derive a kebab-case slug (≤6 words) from the task essence.
   - Suite dir: `<plansDir>/<timestamp>-<slug>/`, where `<plansDir>` is the plans directory resolved above. Don't create it yet — defer the `mkdir` to Phase 5 so the user can cancel during Phase 6 without leaving an empty dir behind. (For adoption, the dir already exists.)
4. **Refuse to overwrite.** If the target dir already contains `index.md`, print:
   ```
   This dir already has a deep plan at <path>/index.md. Use /execute-plan instead.
   ```
   and stop. If it already contains `simple-plan.md`, ask via `AskUserQuestion`: "An existing simple plan is present — overwrite, write a new suite, or cancel?" with options "Overwrite", "Write new suite", "Cancel".
5. **Tolerate malformed `context.md`.** If present but missing the H1, frontmatter, or `## Task`, log:
   ```
   ⚠ Ignoring malformed context.md at <path> — proceeding without it.
   ```
   Don't abort. Still write output into the existing dir (don't orphan it).

### Phase 1 — Restate

Restate the task in one paragraph. If `context.md` was adopted, seed the restatement from its `## Task` section and any listed assumptions/constraints, and cite which assumptions came from intake (e.g. "from intake: scope is limited to `src/cli.ts`").

### Phase 2 — Brief exploration

Read only the files the change is likely to touch — typically 1–3 files. Document discovered patterns or gotchas that affect *this specific change* (e.g. "the existing flag parsing uses a `parseFlags()` helper at `src/cli.ts:42`"). Do **not** map the broader codebase.

**Bailout check during exploration.** If you discover any of the following, fire the bailout rule (see [Bailout](#bailout)) and stop:
- The task has ≥2 viable approaches with different tradeoffs.
- The change touches more than 5 files.
- The change requires more than ~8 implementation steps.

### Phase 3 — Specify

Write the body of `simple-plan.md` in memory (don't persist yet). Required content:

- **`## Task`** — one paragraph (the Phase 1 restatement).
- **`## Files Changed`** — every file that changes, one-line intent each.
- **`## Steps`** — short numbered list (≤8 steps). Each step is a concrete action.
- Follow the code-in-plans rule from [`skills/deep-plan/PLAN-FORMAT.md`](../deep-plan/PLAN-FORMAT.md) — plans contain interfaces and intent, not implementation bodies.

Also re-evaluate the bailout thresholds against the final spec. If the spec needs >8 steps or >5 files to be honest, bail out.

### Phase 4 — Risk & Verify

One short section combining:
- **Risks / edge cases / failure modes** — bullet list with mitigations.
- **Acceptance criteria** — numbered checklist of objectively verifiable conditions. Typical: 2–4 criteria.

### Phase 5 — Persist

1. If minted (not adopted), create the suite dir: `mkdir -p <plansDir>/<timestamp>-<slug>/`.
2. If the config's `gitignore` flag is true (default), and a `.gitignore` exists at the project root that does not already contain `<plansDir>/`, append `<plansDir>/` to it. If `.gitignore` does not exist, create it with that single line. Check first to avoid duplicates. If `gitignore` is false, skip this step entirely.
3. Write `simple-plan.md` into the suite dir using the [Output file shape](#output-file-shape) below.

### Phase 6 — Confirm

Print a one-block summary of what was written (path + one-line task + file count + acceptance-criteria count), then call `AskUserQuestion`:

- "Approve & implement now" — proceed to Phase 7 and do the work in this session.
- "Approve plan only" — keep the file, don't run.
- "Revise" — change something in the plan.
- "Discard" — throw the plan away.

**On Approve & implement now**, print:
```
✅ Approved. Implementing now.

Simple plan: <suite-dir>/simple-plan.md
```
then proceed to Phase 7.

**On Approve plan only**, print:
```
✅ Approved.

Simple plan written: <suite-dir>/simple-plan.md

Implement when ready — this plan is not designed for /execute-plan handoff.
```
and end the turn.

**On Revise**, ask the user in plain text: "What would you like to change?" Apply the revision, re-write `simple-plan.md`, and loop back to Phase 6.

**On Discard**, delete the suite dir (`rm -rf <suite-dir>`) if it was minted by this run. If the dir was adopted (already contained `context.md`), delete only `simple-plan.md` and leave the rest. Confirm with a one-liner: `↩️ Discarded simple-plan.md.`

### Phase 7 — Execute (only if user picked "Approve & implement now")

Implement the plan **in this session**, in the order specified by the `## Steps` section of `simple-plan.md`.

This is safe to do in-session because Phase 2 exploration was tight (1–3 files) — the context isn't bloated the way it would be after a `/deep-plan` run. That's the whole point of simple-plan: small enough to plan and execute together.

Rules:
- Execute steps in order. Don't reorder, skip, or merge without asking.
- If a step turns out to be wrong-as-specified, stop and ask the user. Don't silently work around the plan.
- After all steps, walk through the acceptance criteria checklist. For each: ✅ or ❌ with a one-line reason for any ❌.
- Do **not** update `simple-plan.md` to reflect implementation status — it is a planning artifact, not a tracker. The acceptance-criteria checkboxes stay as `- [ ]` for future reference. (Use git to see what changed.)
- Do **not** commit the changes. Leave that to the user.

Final report (after execution):
```
Implementation report

Acceptance criteria:
  ✅ <criterion>
  ❌ <criterion> — <reason>

Files changed:
  - <path>
```

If any criteria are ❌, do not claim the work is complete.

## Bailout

If during Phase 2 or Phase 3 you determine the task exceeds simple-plan's bounds (≥2 viable approaches, >5 files, or >8 steps), **stop**. Do **not** write `simple-plan.md`. Print:

```
⚠️  This task looks bigger than a simple plan can hold (reason: <reason>).
Recommend: rerun with /deep-plan on this same suite dir:
  claude "/deep-plan <suite-dir>"
```

The bailout is one-shot — end the turn. Any adopted `context.md` stays in place for `/deep-plan` to pick up. Any minted dir is left empty *only if* the bailout fired after `mkdir` — since `mkdir` is deferred to Phase 5, a Phase 2/3 bailout means no dir was created.

## Output file shape

`simple-plan.md` body:

```markdown
# Simple plan: <task title>

> **From intake:** `context.md` | (none)

## Task
<one paragraph>

## Files Changed
- `<path>`: <one-line intent>

## Steps
1. <step>

## Risks & Verification
- <risk>: <mitigation>
- [ ] <acceptance criterion>
```

Notes:
- The `From intake:` line is `` `context.md` `` (a backticked filename) when the suite dir was adopted, and `(none)` when minted fresh.
- The `Risks & Verification` section mixes risk bullets and acceptance-criteria checkboxes. Risks are plain bullets; acceptance criteria use `- [ ]` so they read as a checklist.

## Constraints

- **Single output file.** Never write `index.md`. Never write chunk files. Never write more than one plan file.
- **No `/execute-plan` handoff.** The simple-plan output is not in `/execute-plan`'s input format and `/plan-tracker` ignores dirs without `index.md`. Implementation happens either in-session (Phase 7) or by the user later — never via `/execute-plan`. Do not suggest `claude "/execute-plan <path>"` in the approval block.
- **Refuse to overwrite.** Never silently overwrite an existing `index.md` or `simple-plan.md` (see Phase 0).
- **Bailout, don't stretch.** If the task exceeds simple-plan's bounds, recommend `/deep-plan` and stop. Don't try to compress a large task into a simple plan.
- **Read-only during Phases 1–4.** Planning-phase writes are limited to Phase 5 (`simple-plan.md`, optional `.gitignore`, optional `mkdir` for the suite dir) and the optional discard in Phase 6. Phase 7, if invoked, performs code edits per the plan.
- **Do not auto-invoke other skills.** The bailout *recommends* `/deep-plan`; it does not run it.
