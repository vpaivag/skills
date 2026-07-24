# CONTEXT-FORMAT

The shape of `context.md` — the intake artifact `/plan` writes into the suite directory before any planning happens. This file is the **only** input the blind `qa-author` agent receives, so it must capture intent and observable behavior without describing implementation.

## Schema

```markdown
---
artifact: context
title: <task title>
path: design | mechanical
reason: <one line — gate criterion + justification, or "mechanical - no gate criterion met">
created: <YYYY-MM-DD>
---

# Context: <task title>

## Task

<one-paragraph restatement of the task in the planner's voice — the same restatement shown to the user during Restate>

## Expected behavior

- EB-1: <user-visible outcome, stated as observable behavior — what someone using the software will see working, not how it is built>
- EB-2: <outcome>

## What the user already knows

- <bullet, only if elicited during Q&A>

## Where to look first

- `<path or component>` — <one-line reason>

## Constraints

- <constraint, only if elicited>

## Open questions

- <question raised during intake but not resolved>
```

## Rules

- **Required:** the YAML frontmatter with all five keys, `## Task`, and `## Expected behavior` with at least one `EB-n` item.
- **Optional:** everything below `## Expected behavior`. Omit any section with no content — no placeholder headers.
- `path:` is exactly one of `design` or `mechanical`.
- `reason:` is a single line. For `design`, it names the gate criterion that fired (`hard-to-reverse`, `surprising-without-context`, `real-tradeoff`, or `cross-concern`) plus a short justification. When `cross-concern` fires, name the kinds of work involved (e.g. `cross-concern: migration + model + serializer`). For `mechanical`, it is `mechanical - no gate criterion met`.
- **`EB-n` IDs are stable and sequential.** Downstream artifacts trace to them: `qa-plan.md` criteria declare which `EB-n` they cover, and QA coverage is judged against this list. Never renumber existing items when revising — append.
- **`## Expected behavior` is implementation-free.** It describes contracts observable from outside the code: requests and responses, CLI invocations and their output, UI actions and what the user sees. Never internal function names, file paths, or design choices — the `qa-author` derives behavioral criteria from this section without ever seeing the plan, and anything implementation-shaped here would leak the planner's bias into QA.
