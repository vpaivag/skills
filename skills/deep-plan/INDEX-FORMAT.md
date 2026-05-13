# Index format

Every suite directory (`<plansDir>/<timestamp>-<feature-slug>/`, where `<plansDir>` is read from `.claude/plans-config.json` → `plansDir` and defaults to `.claude/plans`) contains an `index.md` describing the suite and its chunks. This is true even when there is only one chunk — the index is the canonical entry point.

## Single-chunk suite

When `deep-plan` produced one chunk, the suite contains `index.md` + `plan.md`.

```markdown
# Suite: <Feature name>

## Goal
<1–2 sentences describing the overall feature/goal.>

## Chunks
1. **plan** — `plan.md`
   - Status: pending
   - Depends on: (none)
```

## Multi-chunk suite

When `deep-plan` decomposed the work, the suite contains `index.md` + one chunk file per chunk.

```markdown
# Suite: <Feature name>

## Goal
<1–2 sentences describing the overall feature/goal.>

## Chunks
1. **<chunk-name>** — `<chunk-filename>.md`
   - Status: pending
   - Depends on: (none) | <chunk-name>, <chunk-name>
2. **<chunk-name>** — `<chunk-filename>.md`
   - Status: pending
   - Depends on: <chunk-name>
```

## Status values

Each chunk's `Status:` field is one of:

- `pending` — not started
- `in-progress` — currently being executed
- `done` — successfully completed
- `blocked` — needs human resolution before it can proceed

The status appears in **two** places and the two must stay in sync:
1. The `Status:` line under the chunk's entry in `index.md`
2. The `> **Status:**` line in the chunk file's frontmatter