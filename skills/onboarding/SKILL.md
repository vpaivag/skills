---
name: onboarding
description: Guided onboarding for newcomers to a codebase. Three phases — gate on CLAUDE.md quality, run a conversational tour driven by CLAUDE.md and the docs it points at, then write one contrived hands-on task to `.claude/onboarding-task.md` for the newcomer to implement themselves on a sandbox branch. Read-only on the codebase during the tour; writes exactly one artifact. Aborts with a pointer to `/claude-md-refactor` (bootstrap mode) if CLAUDE.md is missing, and warns + offers an override if it looks thin. Use when the user invokes /onboarding, says "I'm new to this codebase", "help me onboard", "give me a tour of this repo", "show me around", or otherwise asks to be ramped up on an unfamiliar project.
---

# /onboarding

Ramp a newcomer up on an unfamiliar codebase. The skill leans on `CLAUDE.md` (and the `/docs/` files it indexes, per the `claude-md-refactor` pattern) as the source of truth — the tour is only as good as those docs.

Three phases: gate → tour → task. The tour is conversational and writes nothing. The contrived hands-on task is written to a single fixed-path file so the newcomer can resume across sessions.

This skill does NOT write `CLAUDE.md` for the user, and does NOT implement the contrived task. Writing docs is `/claude-md-refactor`'s job; implementing the task is the newcomer's job — that's the point.

## Required tool

This skill requires the `AskUserQuestion` tool. If it is not available, stop immediately and tell the user this skill requires a recent version of Claude Code (run `claude update`).

## Operating mode

- **Read-only on the codebase.** `Read`, `Glob`, `Grep` only during the tour.
- **One write.** Exactly one file: `.claude/onboarding-task.md`. No tour notes, no other artifacts.
- **Does not invoke other skills.** Phase 1 points at `/claude-md-refactor` when needed, but the maintainer runs it — not this skill.

## Phases

### Phase 1 — CLAUDE.md precondition gate

Before anything else, check `CLAUDE.md` at the project root.

- **Missing.** Stop. Tell the user `/onboarding` needs a `CLAUDE.md` written by someone who knows the codebase, and that the right next step is to ask a maintainer to run `/claude-md-refactor` (bootstrap mode). Do not attempt to write `CLAUDE.md` yourself. End the skill.

- **Present but thin.** Apply a soft heuristic. Treat any one of these as a "thin" signal:
  - file is under ~20 non-blank lines, OR
  - contains zero links/pointers to other docs (no `/docs/`-style references, no markdown links to siblings), OR
  - has no concrete project-specific content (reads like generic boilerplate), OR
  - links point to files that don't exist (broken index).

  If at least one signal fires, surface the concern and ask via `AskUserQuestion`:
  - "`CLAUDE.md` looks thin — a richer one would make this tour much better. How do you want to proceed?"
  - Options: "Stop and recommend /claude-md-refactor (Recommended)" / "Continue with what's there".

  Respect the answer. If they stop, end the skill with a short pointer to `/claude-md-refactor`.

- **Healthy (or user opted to continue).** Proceed to Phase 2.

Note in passing — once, briefly — that the tour reflects what `CLAUDE.md` says. If the docs are out of date or wrong, the tour will be too.

### Phase 2 — Conversational tour

Read `CLAUDE.md` end-to-end. Then follow every link and pointer it contains and read those linked docs as well — `CLAUDE.md` is meant as an index, with the substance in `/docs/<topic>.md` (the progressive-disclosure pattern from `/claude-md-refactor`).

Drive an interactive walkthrough in conversation. Suggested structure (use as a guide, not a rigid template — adapt to what the docs emphasize):

- **Project identity** — what this repo is, what it does, what stack.
- **Layout tour** — top-level directories and what each holds; point to one concrete example file per major area.
- **Conventions and patterns** — the project-specific patterns the newcomer must internalize (naming, testing, error handling, module boundaries — whatever the docs stress).
- **Gotchas** — any "always do X" / "never do Y" rules.

Pace yourself. After each section, ask via `AskUserQuestion` whether the user wants to go deeper, move on, or skip ahead. Don't dump everything at once.

Do **not** write any file during this phase. The tour is conversational.

### Phase 3 — Contrived hands-on task

Synthesize a small task that lets the newcomer practice what they just learned. It must:

- **Touch real files** in the repo (so the newcomer practices navigation).
- **Exercise at least one project pattern** observed during the tour (a naming convention, the testing style, the error-handling shape — pick whatever was emphasized).
- **Be throwaway.** The task spec must say explicitly: do this on a sandbox branch and discard the work.
- **Be sized for ~30–60 minutes.** Not a feature; a small, focused exercise.

If the repo has no obvious patterns to exercise, fall back to a generic task: add a new file in the canonical location for its type, with the canonical naming. Better generic than fake-specific.

Write the task to `.claude/onboarding-task.md` (single fixed path; not under `.claude/plans/`, since this is unrelated to planning).

**If the file already exists**, ask via `AskUserQuestion` before writing: "Overwrite (Recommended) / Cancel". No append option — task files don't compose.

Task spec structure (in the file itself):

1. **Title.**
2. **Header note** — one short paragraph that says: this task is for you (the newcomer) to implement; the agent will not implement it for you; that's the point. Work on a sandbox branch and throw it away when done.
3. **Context** — one paragraph framing the task in repo terms.
4. **Goal** — one or two sentences on what "done" looks like.
5. **Files you'll likely touch** — a short list, real paths.
6. **Suggested approach** — high level, a few bullets. Not step-by-step.
7. **What you'll learn** — tie back to the patterns surfaced in the tour.

End the skill by telling the user where the task file was written and suggesting they create a sandbox branch first:

```
git checkout -b onboarding-practice
```

## Constraints

- Writes exactly one file: `.claude/onboarding-task.md`. Nothing else.
- Read-only on the codebase during Phases 1 and 2.
- Does not invoke `/claude-md-refactor` or any other skill — only points the user at `/claude-md-refactor` when the precondition gate fires.
- Does not implement the contrived task. The task file must make this explicit so the newcomer doesn't ask the agent to do it for them.
- No `--real` flag, no Linear/Jira integration, no issue-tracker hooks. v1 scope.
- The thin-CLAUDE.md heuristic is soft and overridable by the user — never hard-refuses on a thin doc, only on a missing one.
