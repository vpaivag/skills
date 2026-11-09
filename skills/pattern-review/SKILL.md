---
name: pattern-review
description: Pattern review of a PR or diff — checks that new and edited code follows the conventions the repo already uses. Describes each changed unit without its code, has blind miner subagents extract the repo's existing conventions for that kind of unit (each backed by 2+ file:line examples) plus the helpers that already do its job, has 2+ comparers check the diff against those conventions, verifies every deviation against the real code, and reports. Use when the user invokes /pattern-review, asks whether a PR or diff follows the repo's patterns or conventions, "does this look like the rest of the codebase?", "is this how we do it here?", or wants to catch reinvented helpers and inconsistent code before merge.
---

# /pattern-review

Check that a diff **looks like the repo it lands in** — same error handling, naming, file placement, test style, and the existing helpers reused instead of rewritten. Not bugs (`/adversarial-review`), not fit to the request (`/intent-review`): only whether the change follows what the repo already does.

## Usage

`/pattern-review [diff]`

- `[diff]` — a PR number or URL, a branch, or a git range. Omitted → uncommitted work.

## The principle

Split context again, two roles kept apart on purpose:

- **The miners** learn the repo's conventions for a kind of code — "an HTTP handler in `api/`", "a test for a service" — from the existing code only. They **never see the new code.** A miner that has read the diff reads the repo looking for permission, and every deviation becomes "a valid variant."
- **The comparers** get the conventions and the diff, and report where they part ways. They never see the request or the author's story; why the author did it differently is the author's argument to make, not the reviewer's to assume.

A convention is what the repo **does repeatedly**, not what one file happens to do. One example is an anecdote.

Repos have **families**: code of one kind often follows its own habits that differ from the rest — the Linear skills in one repo, the admin handlers in another. A unit is judged against its family first, the repo second. Breaking a repo-wide habit the way its family does is following the pattern, not deviating from it.

## Hard rules

- **Run in a separate session from the one that wrote the code.** The author's session will describe units in its own framing and wave off deviations it chose on purpose. If this session authored the diff, stop and tell the user to re-run `/pattern-review` in a fresh session. (A diff this session did not author — someone else's PR — is fine.)
- **Miners never see the diff.** They get a unit description and the base ref, nothing else — no hunks, no new file contents, no PR description.
- **Conventions come from the base, never from the change.** New files are never examples. Edited files count only as they were at the base ref — what a file looked like before the change is evidence, often the best there is; what the change made it is not.
- **A pattern needs 2+ examples.** Every inferred convention cites at least two `file:line` examples at the base ref. A rule written in `CLAUDE.md` or the docs it points at counts with one citation — the doc line. One exception: when a unit's family has a single member, that member's habits count as **sibling precedent** with one example, and the report says so.
- **No consensus, no finding.** Where the repo already does it two ways, that's a note about the repo, never a deviation in the diff.
- **Every finding is verified before it reaches the user.** Unverified deviations are dropped, not hedged.
- **Report only.** No fixes, no commits, no PR comments.

## Out of scope

Bugs, edge cases, and correctness → `/adversarial-review`. Whether the change does what was asked → `/intent-review`. Anything a formatter, linter, or type-checker already enforces in this repo — check its config and leave those to the tool.

## Phases

### Phase 1 — Pin the diff

Resolve `[diff]` to a base and head:

- **PR** — `gh pr view <n> --json baseRefName,headRefOid,files` and `gh pr diff <n>` (or the GitHub MCP). Fetch the head with `git fetch origin pull/<n>/head` so files are readable via `git show <head>:<path>` without touching the working tree.
- **Branch** — `git diff <default-branch>...<branch>`; base is the merge-base.
- **Range** — use it as given.
- **Nothing given** — `git diff` plus `git diff --staged`; base is `HEAD`.

Fail here if the ref doesn't resolve or the diff is empty. Capture the diff, the base ref, and the changed files split into **added** and **edited** (`git diff --name-status`).

### Phase 2 — Describe the units

Group the diff into **units** — one per distinct kind of thing it adds or changes: a new endpoint handler, a new React component, a migration, a test file, an edited service method. For each, write a description **without its code**:

> `U-n` — <kind of thing> · <where it lives> · <what job it does, one line>
> e.g. `U-2 — HTTP handler · api/orders/ · lists a customer's orders, paginated`

The job line is what lets a miner find the helpers that already do that job — keep it about behavior, not implementation ("paginated", not "slices the array with offset").

Read `CLAUDE.md` and the docs it points at; note any documented rule that bears on a unit, with its doc line.

### Phase 3 — Mine conventions (blind to the diff)

Spawn one miner subagent per unit — parallel, one message, multiple Agent calls — or batch small units into one miner. Each gets its unit description(s), the documented rules for them, the base ref, the list of added paths, and the list of edited paths. Its task:

> You are documenting how this repository already writes a certain kind of code. You will not see the new code — work only from the existing repo at `<base>`, reading files with `git show <base>:<path>`. Never use these new files: `<added paths>`. These files are being edited, so use them only as they are at `<base>`: `<edited paths>`.
>
> For the unit described, find the existing code of the same kind: search the repo by meaning for the kind and job with whatever code-search tool you have, and fall back to grep and directory listings.
>
> First find the unit's **family** — its nearest siblings: the files most like it in kind, location, and structure. A family can be one file. Then look wider, at the same kind of code across the repo.
>
> Return:
> - **Family** — the sibling files, and one line on why they are the nearest.
> - **Conventions** (`P-n`) — each one thing done consistently for this kind of code: structure, naming, error handling, file placement, imports, logging, validation, test shape, whatever is actually consistent. Mark each **family** or **repo-wide**. Cite **at least two** `file:line` examples per convention. A documented rule (given below) counts with its doc line. When the family is a single file, its habits count with that one example — mark them **sibling precedent**.
> - **Family overrides** — places where the family consistently does it differently from the rest of the repo, with examples of both. For this unit, the family's way is the convention.
> - **Splits** — aspects where the family (or, with no family habit, the repo) does it two or more ways, with examples of each. These are not conventions.
> - **Existing helpers** — functions, modules, or components that already do part of this unit's job, with `file:line` and one line on what each does.
>
> Report only what you can cite. Outside sibling precedent, a convention with one example is not a convention — leave it out. Do not spawn agents or invoke skills.

Collect every miner's sheet. This is the yardstick for Phase 4.

### Phase 4 — Compare

Spawn **2 or more** comparer subagents in parallel, each given the full set of convention sheets, the diff, and the head ref so they can read full files with `git show <head>:<path>`. Leave out the request, PR description, and commit messages. Its task:

> You are checking whether a code change follows the conventions this repository already uses. The conventions below were extracted from the existing code; treat them as the yardstick. Where a family convention or override conflicts with a repo-wide one, the family's wins for that unit.
>
> For every unit `U-n` and every convention `P-n` that applies to it, return a verdict:
> - **follows** — cite the `file:line` in the change.
> - **deviates** — cite the `file:line` in the change, the convention's examples, and state "repo does: … / change does: …".
> - **n/a** — the convention doesn't apply to this unit; say why in one line.
>
> Then:
> - **Reinvented helpers** — any new code in the change that does what a listed existing helper already does. Cite both.
> - **New patterns** — places where the change consistently does something a different way across several sites, as if deliberately introducing a new convention. Group them; don't list each site as a deviation.
>
> Every applicable convention gets a verdict; silence is not a verdict. Do not comment on bugs, correctness, or whether the change does what it should. Do not spawn agents or invoke skills.

### Phase 5 — Verify

Re-check every `deviates`, reinvented helper, and new pattern against the real code — yourself, or one verifier subagent per finding. A finding survives only if:

- the convention's examples exist at the base ref and actually show the pattern (2+, a documented rule, or sibling precedent),
- the cited line in the change actually departs from it,
- the unit's family doesn't do it the same way the change does — check the nearest siblings yourself, not just the miner's list,
- it isn't a split the repo already has, a case a tool enforces, or a unit the convention doesn't really cover.

Where comparers disagree, the code decides. A new pattern survives as **one** finding naming the convention it displaces and every site. Drop what can't be confirmed and note it under Dropped.

### Phase 6 — Report

Only the surviving findings, one block each. Order: reinvented helpers, then deviations, then new patterns. Never list what follows the conventions. The `U-n` / `P-n` IDs are internal — the report speaks in file paths and plain names.

```markdown
# Pattern review

**Diff:** <PR / branch / range / working tree> — <n> files · **Conventions checked:** <n> · **Findings:** <n>

## Findings

### <short, specific title — e.g. "Reimplements `paginate()` in the orders handler">
**File:** `path:line`
**Repo does:** <the convention, one line> — `example:line`, `example:line` <add "(sibling precedent)" when it rests on one family member>
**Change does:** <what the change does instead, one line>

\`\`\`<lang>
// repo — example:line
<existing snippet>
// change — path:line
<new snippet>
\`\`\`

**Fix:** <reuse `<helper>` from `path:line`, or follow the convention>

---

### New pattern: <what the change does differently>
**Sites:** `path:line`, `path:line`, …
**Repo does:** <the convention it displaces> — `example:line`, `example:line`
**Fix:** if intended, say so and migrate the old sites; otherwise follow the convention.

---

(repeat per finding)

## Notes
- **Repo split:** <aspect the repo is already inconsistent on that the change touched — not flagged>
- **Dropped:** <comparer finding that didn't survive verification, and why>

<n> findings: <n> reinvented helpers, <n> deviations, <n> new patterns.
```

Skip `## Notes` when there's nothing in it. A change that fits the repo is a real result — say so plainly.

Do not commit or post. End your turn.
