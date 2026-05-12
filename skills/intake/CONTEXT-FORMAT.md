# CONTEXT-FORMAT

Defines the shape of `context.md` (the artifact `/intake` writes) and the **suite-dir adoption protocol** — the contract that downstream planners (`/simple-plan`, `/deep-plan`) implement when invoked on a suite directory that already contains a `context.md`.

## `context.md` schema

```markdown
# Intake: <task title>

> **Recommended planner:** /deep-plan | /simple-plan
> **Reason:** <one-line rationale from the ADR-gate, e.g. "hard-to-reverse: touches DB schema">

## Task
<one-paragraph restatement of the task in the planner's voice — the same restatement shown to the user during Phase 1>

## What the user already knows
- <bullet, only if elicited during Q&A>

## Where to look first
- <path or component> — <one-line reason>

## Constraints
- <constraint, only if elicited>

## Open questions for the planner
- <question that was raised during intake but not resolved (e.g. because the 5-question cap was hit)>
```

### Required vs. optional

- **Required:** the H1 title, the frontmatter block (`Recommended planner:` + `Reason:`), and the `## Task` section.
- **Optional:** `What the user already knows`, `Where to look first`, `Constraints`, `Open questions for the planner`. **Omit any section with no content** — do not write empty headers with placeholders.

### Frontmatter rules

- `Recommended planner:` is exactly one of `/deep-plan` or `/simple-plan`.
- `Reason:` is a single line. If a `/deep-plan` recommendation, it names the ADR-gate criterion that fired (`hard-to-reverse`, `surprising-without-context`, or `real-tradeoff`) and a short justification. If a `/simple-plan` recommendation, it is `straightforward — no ADR-gate criterion met`.

## Suite-dir adoption protocol

This section defines what `/simple-plan` and `/deep-plan` must do when they encounter an intake-produced suite directory. It is part of the contract — these planners implement this protocol; `/intake` relies on it.

### Detection

A planner adopts an intake suite dir if **either**:

1. It is invoked with an argument that is an existing directory under `.claude/plans/` containing a `context.md`, **or**
2. It is invoked with no argument **and** exactly one directory under `.claude/plans/` contains a `context.md`, no `index.md`, and no `simple-plan.md`.

If neither condition holds, the planner runs as it normally would (creating a fresh suite dir during its persist phase).

### Behavior on adoption

When adopting:

1. **Read `context.md`** before any other action.
2. **Seed Phase 1 (Restate)** from `context.md`'s `## Task` section and the listed assumptions / constraints. Cite the source: assumptions surfaced during intake should be reflected back in the planner's restatement as "from intake".
3. **Write outputs into the same directory.** Specifically:
   - `/deep-plan` writes its `index.md` and one or more chunk files into the existing dir.
   - `/simple-plan` writes its `simple-plan.md` into the existing dir.
4. **Print one adoption line** at the top of the planner's first response:
   ```
   📥 Adopted intake context from <path>/context.md
   ```

### Refuse to overwrite

If the suite dir already contains an `index.md` (for `/deep-plan`) or a `simple-plan.md` (for `/simple-plan`), the planner must **refuse** and ask the user how to proceed (e.g. "An existing plan is present — overwrite, write a new suite, or cancel?"). Overwriting an existing plan is destructive and must not happen silently.

### Tolerate malformed input

If `context.md` is malformed (missing the required H1, frontmatter, or `## Task`) or empty, the planner:

1. Logs a one-line warning: `⚠ Ignoring malformed context.md at <path> — proceeding without it.`
2. Does **not** abort; proceeds with its normal Phase 1 as if no intake had run.
3. Still writes outputs into the existing suite dir (the dir was created for this task; do not orphan it).
