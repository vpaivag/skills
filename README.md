# vpaivag/skills

Personal collection of agent skills for planning, executing, tracking, and reviewing software engineering work — plus a utility for keeping `CLAUDE.md` files lean.

Each skill is a self-contained `SKILL.md` under `skills/<name>/` that loads on demand when its trigger fires. They're designed to compose into one loop:

```
/deep-plan      →  explore the codebase, write a self-contained plan suite
/plan-tracker   →  see what's runnable next
/execute-plan   →  hand a chunk to a fresh session, implement + verify
/review-plan    →  audit whether the suite actually delivered what it promised
```

Plus two standalone skills: `/pr-reviewer` for expert-level pull request reviews, and `/claude-md-refactor` to keep your repo's `CLAUDE.md` from quietly eating every session's context.

## Contents

- [Install](#install)
  - [Via the skills CLI](#via-the-skills-cli)
  - [As a Claude Code plugin](#as-a-claude-code-plugin)
- [Skills](#skills)
  - [deep-plan](#deep-plan)
  - [execute-plan](#execute-plan)
  - [plan-tracker](#plan-tracker)
  - [review-plan](#review-plan)
  - [pr-reviewer](#pr-reviewer)
  - [claude-md-refactor](#claude-md-refactor)
- [Layout](#layout)

## Install

Pick the path that matches your setup:

### Via the skills CLI

Manually add the skills to any agent using the [skills CLI](https://github.com/vercel-labs/skills).

Install all skills:

```bash
npx skills@latest add vpaivag/skills
```

Install a specific skill:

```bash
npx skills@latest add vpaivag/skills --skill deep-plan
```

Target a specific agent (e.g. Claude Code):

```bash
npx skills@latest add vpaivag/skills -a claude-code
```

### As a Claude Code plugin

This repo is a Claude Code plugin marketplace. Add the marketplace, then install the `skills` plugin:

```
/plugin marketplace add vpaivag/skills
/plugin install skills@vpaivag
```

Update later with:

```
/plugin marketplace update vpaivag
```

Or point Claude Code at a local clone:

```
/plugin marketplace add /path/to/skills
```

## Skills

### deep-plan

**Trigger:** `/deep-plan` or asking for a deep/thorough plan before implementation.

Produces a rigorous, self-contained implementation plan for a coding task. Explores the codebase read-only, considers alternatives, enumerates risks, and writes a **plan suite** — a directory containing an `index.md` plus one or more chunk files — that can be picked up and executed by a fresh Claude Code session with no prior conversation context.

Highlights:
- **Read-only during planning.** No edits, no git mutations, no side effects until the final write phase.
- **Right-sizes the work.** Trivial tasks don't get over-planned; under-decomposed tasks get split into multiple chunks with explicit dependencies.
- **Hand-off ready.** Output is designed to be executed via `/execute-plan` with zero context loss.

→ [`skills/deep-plan`](./skills/deep-plan)

### execute-plan

**Trigger:** `/execute-plan <path-to-chunk-file>`.

Executes a chunk file produced by `/deep-plan`. Reads the specified chunk, validates suite dependencies via the suite index, confirms the file list and order with the user, implements changes in sequence, verifies each acceptance criterion, and prompts for the final status update on the suite.

Works on both single-chunk suites (`plan.md`) and individual chunks of a multi-chunk suite.

→ [`skills/execute-plan`](./skills/execute-plan)

### plan-tracker

**Trigger:** `/plan-tracker` or questions like "what's the state of the plan?", "what's next?", "what's left?".

Read-only status view for plan suites in the current project. Detects the active suite, shows per-chunk status and dependency relationships, and surfaces what's runnable next. Never modifies plan files.

→ [`skills/plan-tracker`](./skills/plan-tracker)

### review-plan

**Trigger:** `/review-plan` or asking "is the plan actually done?", "did we deliver what the plan promised?", "is the suite status honest?".

Read-only audit that closes the planning loop. Compares a suite's `index.md` goal and per-chunk acceptance criteria against the actual git diff since the suite was created, then reports goal alignment, coverage gaps, drift (changes not traceable to any chunk), and status-sanity issues (chunks marked `done` whose criteria don't appear satisfied in the code).

Pairs with `plan-tracker`: tracker shows recorded status, review-plan checks whether that status is telling the truth. Never edits the plan, never marks chunks done, never touches code.

→ [`skills/review-plan`](./skills/review-plan)

### pr-reviewer

**Trigger:** asking to review a PR, look at a pull request, do a code review, check a branch before merge, or "what do you think of #123 / this branch?".

Performs a thorough, expert-level pull request review and returns a structured report with issues categorized by severity, including code snippets. Reads surrounding code (not just the diff) before flagging anything, and refuses to fabricate issues.

Hard rules baked in:
- **Never posts to the PR** unless the user explicitly says so after seeing the report.
- **Never modifies the PR's code** — the reviewer reviews, the author authors.

→ [`skills/pr-reviewer`](./skills/pr-reviewer)

### claude-md-refactor

**Trigger:** mentions of `CLAUDE.md` being too long, bloated, eating context, or asks to set up / audit / split / restructure a `CLAUDE.md` (or `AGENTS.md`-style instructions).

Refactors, audits, or bootstraps a repository's `CLAUDE.md` so it stays a lean **index of pointers** to `/docs/<topic>.md` files instead of bloating every session's context. Applies progressive disclosure: short root file, detail loaded on demand.

Three modes:
- **Audit** an existing `CLAUDE.md` and split it.
- **Bootstrap** a `CLAUDE.md` + `/docs` for a repo that has none.
- **Confirm** a healthy `CLAUDE.md` doesn't need changes (avoids over-editing).

→ [`skills/claude-md-refactor`](./skills/claude-md-refactor)

## Other useful skills

This bundle isn't the only one worth installing. [`mattpocock/skills`](https://github.com/mattpocock/skills) has a great companion set — examples:

- **`grill-me`** — interview-style stress test that drills into a plan or design until every branch of the decision tree is resolved.
- **`improve-codebase-architecture`** — guided pass for spotting and improving structural problems across a codebase.

See the full list at [github.com/mattpocock/skills](https://github.com/mattpocock/skills).

## Layout

```
.claude-plugin/plugin.json
skills/
  claude-md-refactor/SKILL.md
  deep-plan/SKILL.md
  execute-plan/SKILL.md
  plan-tracker/SKILL.md
  pr-reviewer/SKILL.md
  review-plan/SKILL.md
```