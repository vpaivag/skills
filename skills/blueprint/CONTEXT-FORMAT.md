# CONTEXT-FORMAT

The shape of `context.md` — the intent artifact `/blueprint` writes into the suite directory. This file is the **only** input the blind `qa-author` agent receives, so it must capture intent and observable behavior without describing implementation.

## Schema

```markdown
---
artifact: context
title: <task title>
source: <issue reference or URL the task came from, or "prompt">
created: <YYYY-MM-DD>
---

# Context: <task title>

## Task

<one-paragraph restatement of the task in the planner's voice — the same restatement shown to the user during Restate, refined by the interview>

## Expected behavior

- EB-1: <user-visible outcome, stated as observable behavior — what someone using the software will see working, not how it is built>
- EB-2: <outcome>

## Out of scope

- <behavior deliberately not part of this task, with a one-line reason>

## What the user already knows

- <bullet, only if elicited during the interview>

## Where to look first

- `<path or component>` — <one-line reason>

## Constraints

- <constraint, only if elicited>

## Open questions

- <question raised but deliberately left open, with why it doesn't block the plan>
```

## Rules

- **Required:** the YAML frontmatter with all four keys, `## Task`, and `## Expected behavior` with at least one `EB-n` item.
- **Optional:** everything below `## Expected behavior`. Omit any section with no content — no placeholder headers.
- `source:` is the issue identifier or URL when the task came from one (Linear, GitHub, any tracker), otherwise `prompt`.
- **`EB-n` IDs are stable and sequential.** Downstream artifacts trace to them: `qa-plan.md` criteria declare which `EB-n` they cover, and QA coverage is judged against this list. Never renumber existing items when revising — append. Edge cases surfaced by the interview or the gap review become their own `EB-n` items, not footnotes.
- **`## Expected behavior` and `## Out of scope` are implementation-free.** They describe contracts observable from outside the code: requests and responses, CLI invocations and their output, UI actions and what the user sees. Never internal function names, file paths, or design choices — the `qa-author` derives behavioral criteria from these sections without ever seeing the plan, and anything implementation-shaped here would leak the planner's bias into QA.
