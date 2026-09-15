# ISSUE-FORMAT

The shape of a Linear issue written by `/issue`. The reader is a dev or a coding agent who never saw the conversation that produced it — the issue is the whole brief. One format for every issue type; only the *content* of a section changes with the type.

This artifact lives in Linear, not on disk, so it carries no YAML frontmatter and no stable IDs.

## Title

- Imperative verb first, then the outcome: `Fix duplicate PDA buttons across local servers`, `Add inactive users monthly email`.
- At most 70 characters.
- No bracket prefixes (`[API]`, `[BUG]`) — team and labels carry that.

## Schema

```markdown
## Context

<why this work exists, in plain prose>

## Acceptance

- [ ] <observable outcome>
- [ ] <observable outcome>

## Out of scope

- <what this issue leaves untouched>

## Pointers

- `<path or component>` — <existing pattern to reuse, or suspected cause>

## References

- <link — Sentry, Slack thread, PR, design, doc>
```

## Content by type

| Section | Bug | Feature / Improvement | Parent issue | Sub-issue |
|---|---|---|---|---|
| **Context** | Steps to reproduce, actual vs. expected, where it happens | Why we're building it, the user need, quoted feedback | The user-facing goal of the whole feature | One line: what this layer contributes to the parent's goal |
| **Acceptance** | Expected behavior holds; a regression test covers the reproduction | What the user or caller can observe when done | The end-to-end outcome, across all layers | This layer's contract only (endpoint shape, screen behavior) |
| **Out of scope** | Related bugs not fixed here | What the feature won't do | What the feature won't do | The other layers, by sub-issue title |
| **Pointers** | Suspected files, log lines | Files and patterns to reuse | Omit | Files and patterns for this layer |

## Rules

- **Required:** a title per the rules above, `## Context`, `## Acceptance` with at least one checkbox, and `## Out of scope` with at least one bullet (`None` is a valid bullet when nothing is excluded).
- **Optional:** `## Pointers` and `## References`. Omit a section with no content — no placeholder headers.
- **Headings stay in English** in every language, so every issue in the workspace has the same skeleton. Prose follows the language the user chose.
- **Verbatim material stays verbatim:** code identifiers, paths, error messages, and quoted user reports are never translated or paraphrased.
- **Self-contained.** Every reference to prior discussion is replaced with its content or a link. The reader has the issue, the repo, and nothing else.
- **Acceptance describes outcomes.** Each item is checkable by someone looking at the running system. How to build it belongs in Pointers, as hints.
- **One issue, one PR.** If Acceptance needs more than ~5 items or spans layers, the work is a parent with sub-issues.
- **Relations live in Linear fields, not prose.** Blocked-by, blocks, and parent are set on the issue. Context mentions a blocker only when *why* it blocks matters to the reader.
- **Trivial work stays small:** a title, a one-line Context, one Acceptance item, `Out of scope: None`.

## Example — bug

**Title:** `Fix guard seeing PDA buttons from other accesses`

```markdown
## Context

A guard at access A sees the PDA buttons configured for access B. `app_buttons`
is scoped by `installation_id` only, so every local server of an installation
receives every button. Invisible while installations had one server; now an
installation can run two servers on separate LANs, one per access.

## Acceptance

- [ ] A local server syncs only the buttons assigned to it
- [ ] Existing installations with a single server keep all their buttons
- [ ] A request spec covers two servers in one installation receiving disjoint buttons

## Out of scope

- Backoffice UI for assigning buttons to a server

## Pointers

- `Local::Sync::PdaButtonsController` — current unscoped query
```
