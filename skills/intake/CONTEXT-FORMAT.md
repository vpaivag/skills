# CONTEXT-FORMAT

The shape of `context.md` — the single artifact `/intake` writes into a suite directory.

## Schema

```markdown
# Intake: <task title>

> **Recommended planner:** /deep-plan | /simple-plan
> **Reason:** <one-line rationale, e.g. "hard-to-reverse: touches DB schema" or "straightforward — no ADR-gate criterion met">

## Task
<one-paragraph restatement of the task in the planner's voice — the same restatement shown to the user during Phase 1>

## What the user already knows
- <bullet, only if elicited during Q&A>

## Where to look first
- <path or component> — <one-line reason>

## Constraints
- <constraint, only if elicited>

## Open questions for the planner
- <question raised during intake but not resolved (e.g. because the question cap was hit)>
```

## Rules

- **Required:** H1 title, the `Recommended planner:` + `Reason:` block, and `## Task`.
- **Optional:** everything below `## Task`. Omit any section with no content — no placeholder headers.
- `Recommended planner:` is exactly one of `/deep-plan` or `/simple-plan`.
- `Reason:` is a single line. For `/deep-plan`, it names the ADR-gate criterion that fired (`hard-to-reverse`, `surprising-without-context`, `real-tradeoff`, or `cross-concern`) plus a short justification. When `cross-concern` fires, name the kinds of work involved (e.g. `cross-concern: migration + model + serializer`). For `/simple-plan`, it is `straightforward — no ADR-gate criterion met`.
