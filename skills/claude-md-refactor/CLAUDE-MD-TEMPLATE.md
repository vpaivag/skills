# CLAUDE.md template

The shape a refactored or bootstrapped CLAUDE.md should take. Sections are optional — drop ones that don't apply to the repo.

## Skeleton

```markdown
# <Project name> — agent guide

<1-2 sentence what-this-repo-is, only if not obvious from package.json/README>

## Hard rules
- <Short imperative rules. One line each. No long explanations — those go in /docs.>

## Stack & tooling
- <One-line facts: package manager, framework, DB, deploy target>

## Patterns & playbooks
Read the relevant doc when the task touches it.

- **Deferred loading** — `/docs/deferred-loading.md` — how modules are lazy-loaded and when to add a new one
- **Testing** — `/docs/testing.md` — test layout, fixtures, run commands
- **DB migrations** — `/docs/migrations.md` — playbook for adding/running migrations safely
- **Deployment** — `/docs/deployment.md` — release flow and rollback

## Pointers
- Issues / tickets: <link or "see Linear project X">
- <Other external references>
```

## Pointer line anatomy

Each pointer line should answer: **what topic**, **what file**, **when to read it**.

Good: `**Deferred loading** — /docs/deferred-loading.md — how modules are lazy-loaded and when to add a new one`

Bad: `See /docs/deferred-loading.md` (no topic, no trigger hint — Claude won't know when to open it)

The "when to read it" hint is what makes progressive disclosure actually work. Without it, the doc may as well be inlined.
