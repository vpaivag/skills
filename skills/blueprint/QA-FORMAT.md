# QA-FORMAT

The shape of `qa-plan.md` — the behavioral verification plan the blind `qa-author` agent writes into the suite directory. It is derived **solely** from `context.md`; the author never sees `plan.md`, the proposals, or the diff. `/qa` consumes this file in a fresh, plan-blind session.

## Schema

```markdown
---
artifact: qa-plan
title: <task title>
derived_from: ./context.md
blind: true
created: <YYYY-MM-DD>
---

# QA plan: <task title>

## Intent

<one-paragraph restatement of what the user asked for, in behavioral terms — taken from context.md's Task and Expected behavior sections>

## Behavioral criteria

- [ ] B-1 (covers EB-1): <observable criterion — a concrete stimulus and the expected observable result>
  - verify: <how to check it from outside the code — the request to send, command to run, or UI action to perform, and what to expect back>
- [ ] B-2 (covers EB-1): <edge or negative case for the same behavior>
  - verify: <how>
- [ ] B-3 (covers EB-2): <criterion>
  - verify: <how>

## Regression guard

- [ ] R-1 (covers EB-2): <existing behavior that must remain unchanged, stated observably>
  - verify: <how>

## Out of scope

- <behavior deliberately not covered, with one-line reason>
```

## Rules

- **Required:** the YAML frontmatter with all five keys, `## Intent`, and `## Behavioral criteria` with at least one `B-n` item. `## Regression guard` and `## Out of scope` are optional — omit when empty.
- **Every `B-n` names the `EB-n` it covers, and `R-n` items may too.** An expected behavior of the form "X keeps working unchanged" is naturally covered by a regression guard — annotate the `R-n` with `(covers EB-n)` just like a `B-n`. Every `EB-n` in `context.md` must be covered by at least one `B-n` or `R-n`; if one can't be turned into a verifiable criterion, list it under `## Out of scope` with the reason. Coverage is checkable mechanically: the union of `covers` references across `B-n` and `R-n` must equal the set of `EB-n` IDs.
- **Criteria are implementation-agnostic.** They may only reference what is observable from outside the code: HTTP requests and responses, CLI invocations and output, UI actions and visible results, file formats, exit codes. Never internal function names, module paths, or design vocabulary — the author hasn't seen them, and naming them would mean the blindness leaked.
- **Each criterion is a stimulus → observation pair.** "Filtering works" is not a criterion; "`GET /items?x=1` returns only items where `X = 1`" is. Include the negative and edge cases the intent implies (invalid input, empty result, unchanged default behavior).
- **`verify:` must be executable by a stranger.** A person or agent with no context should be able to perform the check from that line alone.
- **`B-n` and `R-n` IDs are stable and sequential.** The QA report references them by ID. Never renumber when revising — append.
