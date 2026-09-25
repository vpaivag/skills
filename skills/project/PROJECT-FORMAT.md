# PROJECT-FORMAT

The shape of a Linear project written by `/project`. The readers are the lead, the team building it, and whoever checks progress later — none of them saw the conversation that produced it. The project says what and why; the issues say how.

This artifact lives in Linear, not on disk, so it carries no YAML frontmatter and no stable IDs.

## Name and summary

- **Name:** a noun phrase for the outcome, at most 50 characters: `Per-server PDA buttons`, `Inactive-user reactivation`.
- **Summary** (the `summary` field, at most 255 characters): one sentence, the goal in plain words.
- No bracket prefixes, no team names — teams and labels carry that.

## Schema

```markdown
## Problem

<why this exists now — who is hurt, the evidence, quoted feedback>

## Goal

<the end state in one or two sentences>

**Success signal:** <how we'll know it worked — a metric, or a behavior someone can observe>

## Scope

- <feature> — <its observable outcome>
- <feature> — <its observable outcome>

## Out of scope

- <what this project will not do>

## Risks and open questions

- <unknown, and what would settle it>

## References

- <link — Slack thread, doc, design, dashboard>
```

## Rules

- **Required:** a name and summary per the rules above, `## Problem`, `## Goal` with a `**Success signal:**` line, `## Scope` with at least two features, and `## Out of scope` with at least one bullet (`None` is a valid bullet when nothing is excluded).
- **Optional:** `## Risks and open questions` and `## References`. Omit a section with no content — no placeholder headers.
- **Scope lists features.** Each bullet is one feature that becomes one `/issue` run — an issue or a parent issue. A single feature is never a project.
- **Milestones are optional and live in Linear fields, not prose.** Use them only when features ship in stages. Each has a name that states the outcome (`Buttons scoped per server`), a one-line description of what "done" means, and a target date when one is known. Never a layer or a phase.
- **Relations live in Linear fields.** Order between features is a blocks relation on their issues, not a sentence in the description.
- **No implementation plan.** Files, endpoints, and how-to belong in the issues' Pointers.
- **Headings stay in English** in every language, so every project in the workspace has the same skeleton. Prose follows the language the user chose.
- **Verbatim material stays verbatim:** code identifiers, error messages, and quoted user reports are never translated or paraphrased.
- **Self-contained.** Every reference to prior discussion is replaced with its content or a link.

## Example

**Name:** `Inactive-user reactivation`
**Summary:** `Bring back users who stopped logging in, and measure which nudge works.`

```markdown
## Problem

38% of users who sign up stop logging in within 60 days, and we only notice
when they churn. Support hears "I forgot I had an account" weekly.

## Goal

Inactive users get a reason to come back, and we can tell which nudge worked.

**Success signal:** 60-day reactivation rate rises from 4% to 10%.

## Scope

- Inactive users monthly email — users inactive 30+ days receive one digest a month
- Reactivation tracking — each return is attributed to the nudge that caused it
- Unsubscribe from nudges — a user can opt out in one click from any nudge

## Out of scope

- Push notifications
- Win-back discounts

## Risks and open questions

- Email deliverability for dormant addresses — settle with a bounce-rate check on the first send
```
