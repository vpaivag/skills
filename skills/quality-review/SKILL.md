---
name: quality-review
description: Quality review of a PR or diff — checks that new and edited code fits the repo it lands in and is soundly designed. Maps each changed unit to the convention doc CLAUDE.md links for it (forms → FORMS.md) and checks the diff against those rules and CLAUDE.md's hard rules, searches the repo for existing helpers the change reimplements, and runs a baseline of design smells (Feature Envy, Primitive Obsession, Shotgun Surgery…) as judgement calls the docs can override. Two comparer subagents, every finding verified against the real code, report only. Use when the user invokes /quality-review (or the old /pattern-review), asks whether a PR or diff follows the repo's patterns or conventions, "does this look like the rest of the codebase?", "is this how we do it here?", asks for a quality or design review, or wants to catch reinvented helpers and design smells before merge.
---

# /quality-review

Check that a diff **is well built for the repo it lands in** — it follows the conventions the repo has written down, reuses the helpers that already exist instead of rewriting them, and doesn't introduce design smells. Not bugs (`/adversarial-review`), not fit to the request (`/intent-review`), not style: only fit and design.

## Usage

`/quality-review [diff]`

- `[diff]` — a PR number or URL, a branch, or a git range. Omitted → uncommitted work.

## The principle

Two axes, kept apart on purpose:

- **Repo rules** — what this repo has decided. The yardstick is what the team wrote down: `CLAUDE.md`'s hard rules and the convention docs it links ("Building a form? → `docs/FORMS.md`"). A rule nobody wrote down is not a convention here — guessing conventions from code is how a review ends up flagging `a ??= b` against `a = a ?? b`. Findings here are hard: each cites a doc section or an existing helper.
- **Design smells** — what good design says regardless of the repo. A fixed baseline of code smells, each a labelled judgement call ("possible Feature Envy"), never a violation. **The repo overrides:** where a linked doc endorses what a smell would flag, the smell is not reported.

They run as separate comparers and are reported in separate sections — never merged, never reranked against each other. Neither comparer sees the request or the author's story; why the author did it differently is the author's argument to make, not the reviewer's to assume.

## Hard rules

- **Run in a separate session from the one that wrote the code.** The author's session will describe units in its own framing and wave off deviations it chose on purpose. If this session authored the diff, stop and tell the user to re-run `/quality-review` in a fresh session. (A diff this session did not author — someone else's PR — is fine.)
- **The yardstick comes from the base, never from the change.** Read `CLAUDE.md` and every doc with `git show <base>:<path>`. If the diff edits one of them, that edit is a proposed convention change — note it, never review against it.
- **Every repo-rule finding cites its source** — a `CLAUDE.md` line, a doc section, or an existing helper's `path` (`symbol`). No source, no finding.
- **Smells cover only the diff's own code.** A smell in untouched code is not this change's problem.
- **Every finding is verified before it reaches the user** — smells included. Plausible is not confirmed; unverified findings are dropped, not hedged.
- **Report only.** No fixes, no commits, no PR comments, no edits to the docs.

## Out of scope

Bugs, edge cases, and correctness → `/adversarial-review`. Whether the change does what was asked → `/intent-review`. Code shape inside a function or component — branch order, syntax, formatting — and anything a formatter, linter, or type-checker in the repo enforces. Writing or fixing convention docs → `/claude-md-refactor`.

## Smell baseline

Each reads *what it is* → *how to fix*. Adapted from Fowler's *Refactoring* (ch. 3) via mattpocock/skills' `code-review`; Duplicated Code is handled as **Duplication** on the repo-rules axis, Mysterious Name is left out as too close to style, and Speculative Generality is judged from the code, never from the request.

- **Feature Envy** — a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps** — the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession** — a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches** — the same `switch`/`if`-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery** — one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change** — one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality** — abstraction with nothing using it: a parameter no caller passes, an interface with one implementation, a hook nothing calls. → delete it; inline back until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man** — a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest** — a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

## Phases

### Phase 1 — Pin the diff

Resolve `[diff]` to a base and head:

- **PR** — `gh pr view <n> --json baseRefName,headRefOid,files` and `gh pr diff <n>` (or the GitHub MCP). Fetch the head with `git fetch origin pull/<n>/head` so files are readable via `git show <head>:<path>` without touching the working tree.
- **Branch** — `git diff <default-branch>...<branch>`; base is the merge-base.
- **Range** — use it as given.
- **Nothing given** — `git diff` plus `git diff --staged`; base is `HEAD`.

Fail here if the ref doesn't resolve or the diff is empty. Capture the diff, the base ref, and the changed files split into **added** and **edited** (`git diff --name-status`).

### Phase 2 — Load the rules and map the units

Read `CLAUDE.md` at the base: its hard rules, and its index of pointers to docs. Note which formatters, linters, and type-checkers the repo configures — their rules are out of scope.

Group the diff into **units** — one per distinct kind of thing it adds or changes: a new form, a new route, a migration, a test file, an edited service method. For each, write one line:

> `U-n` — <kind of thing> · <path> · <what job it does> · doc: <the doc whose pointer covers it, or none>

The job line is what lets the comparer find helpers that already do that job — keep it about behavior, not implementation ("paginated", not "slices the array with offset"). A unit's doc is the one whose `CLAUDE.md` pointer matches its kind ("Building a form?" → a new form). Read each matched doc at the base, once.

A unit with no matching doc is judged on `CLAUDE.md`'s hard rules, the helper search, and the smells — and listed under Notes as **uncovered**. A repo with no convention docs at all still gets those; say so in the report and point to `/claude-md-refactor` for writing them.

### Phase 3 — Compare

Spawn **two** comparer subagents in parallel, one message. Both get the units, the diff, and the head ref so they can read full files with `git show <head>:<path>`. Leave out the request, PR description, and commit messages.

**Repo-rules comparer** — also gets `CLAUDE.md`'s hard rules, each matched doc's rules (quoted with their section headings), the base ref, and the list of added paths. Its task:

> You are checking whether a code change follows the rules this repository has written down, and whether it rewrites code the repo already has. The rules below are the yardstick — nothing else is a convention. Where a doc for a unit and a general rule conflict, the doc wins for that unit.
>
> For a conditional rule ("when a component is used in 2+ places, …"), first check whether the condition actually holds for the changed code.
>
> Return only:
> - **Deviations** — the change breaks a rule. Cite the rule's source (`CLAUDE.md` line or doc › section), the `file:line` in the change, and state "repo does: … / change does: …".
> - **Duplication** — new code that does what existing code already does. For each unit, search the repo at `<base>` by meaning for code that already does its job, with whatever code-search tool you have, falling back to grep; never count these new files: `<added paths>`. Also report the same logic repeated across hunks of the change itself. Cite both sides.
> - **New patterns** — the change consistently does something a different way from a rule across several sites, as if deliberately introducing a new convention. Group them as one; don't list each site.
>
> Don't report what follows the rules, code shape inside a function (branch order, syntax, formatting), or anything tooling enforces. Do not comment on bugs, correctness, or whether the change does what it should. Do not spawn agents or invoke skills.

**Smell comparer** — also gets the smell baseline above, pasted in full. Its task:

> You are checking a code change for design smells. The baseline below is your only list; each finding is a judgement call — name it "possible <smell>".
>
> Look only at code the change adds or edits. For each smell you find, cite the `file:line`, quote the hunk, and state the concrete evidence — the foreign fields a method reaches into, the params that travel together, the parameter no caller passes. Return at most 5, strongest first; if the evidence for one is thin, leave it out.
>
> Don't report duplication, naming, code shape inside a function, or anything tooling enforces. Do not comment on bugs, correctness, or whether the change does what it should. Do not spawn agents or invoke skills.

### Phase 4 — Verify

Re-check every finding against the real code yourself.

A **repo-rule** finding survives only if:
- its source exists at the base — the `CLAUDE.md` line or doc section says what the finding claims,
- the cited line in the change actually departs from it,
- the rule really covers this unit — the right doc, and for a conditional rule, the condition holds,
- for duplication, the existing code exists at the base and really does the same job,
- it isn't code shape or tool-enforced.

A **smell** survives only if:
- the evidence it cites is really there in the change,
- it's in code the diff adds or edits,
- no doc the unit maps to endorses what the smell flags.

A new pattern survives as **one** finding naming the rule it displaces and every site. Drop what can't be confirmed and note it under Dropped.

### Phase 5 — Report

Only the surviving findings, one block each. Two sections, never merged or reranked across. Repo rules order: duplication, then deviations, then new patterns. Never list what follows the rules. `U-n` IDs are internal — the report speaks in file paths, doc sections, and plain names.

```markdown
# Quality review

**Diff:** <PR / branch / range / working tree> — <n> files · **Docs applied:** <list, or none> · **Findings:** <n> repo rules, <n> smells

## Repo rules

### <short, specific title — e.g. "Reimplements `paginate()` in the orders handler">
**File:** `path:line`
**Repo does:** <the rule or helper, one line> — <`CLAUDE.md` line, `docs/FORMS.md` › Validation, or `path` (`symbol`)>
**Change does:** <what the change does instead, one line>

\`\`\`<lang>
// repo — source
<existing snippet or rule text>
// change — path:line
<new snippet>
\`\`\`

**Fix:** <reuse `<helper>` from `path`, or follow the rule>

---

### New pattern: <what the change does differently>
**Sites:** `path:line`, `path:line`, …
**Repo does:** <the rule it displaces> — <source>
**Fix:** if intended, update the doc and migrate the old sites; otherwise follow the rule.

---

## Design smells

### Possible <smell>: <where, one line>
**File:** `path:line`
**Evidence:** <the concrete thing in the code>
**Fix:** <the smell's fix, applied to this code>

---

(repeat per finding)

## Notes
- **Uncovered:** <unit with no convention doc> — checked on hard rules, duplication, and smells only
- **Doc edited:** <this diff changes a convention doc — reviewed against the base version; the edit itself is a convention change to discuss>
- **Dropped:** <comparer finding that didn't survive verification, and why>

Repo rules: <n> findings (<n> duplication, <n> deviations, <n> new patterns) — worst: <one line>. Smells: <n> — worst: <one line>.
```

Skip any section with nothing in it. A change that fits the repo and has no smells is a real result — say so plainly.

Do not commit or post. End your turn.
