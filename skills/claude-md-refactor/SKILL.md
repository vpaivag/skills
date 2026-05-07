---
name: claude-md-refactor
description: Refactor, audit, or bootstrap a repository's CLAUDE.md so it stays lean and acts as an index of pointers to /docs/ files instead of bloating session context. Use this skill whenever the user mentions their CLAUDE.md being too long, bloated, eating context, "collapsing context", needing cleanup, or asks to set up / audit / split / restructure / generate a CLAUDE.md, even if they don't use the word "skill" or "refactor" — also use it when the user wants project memory or AGENTS.md style instructions organized for both humans and agents.
---

# CLAUDE.md Refactor

## Why this exists

CLAUDE.md is loaded into context on every turn. Every line there is a tax paid by every interaction in the repo, forever. Long CLAUDE.md files crowd out the actual task and degrade model performance.

The fix is **progressive disclosure**: keep CLAUDE.md as a short index of pointers, and move procedural content into `/docs/<topic>.md` files that only get read when they're actually relevant.

This skill helps the user:
- **Audit** an existing CLAUDE.md and split it
- **Bootstrap** a CLAUDE.md + docs for a repo that has none
- **Confirm** a healthy CLAUDE.md doesn't need changes (don't over-edit)

## What stays in CLAUDE.md vs. what gets extracted

CLAUDE.md should contain only what Claude needs **on every turn**:

**Stays in CLAUDE.md:**
- Hard rules and prohibitions ("never run `db:reset` against prod", "always use pnpm not npm")
- Tooling identity ("this is a Next.js 14 app with Drizzle ORM")
- One-line pointers to topic docs (the index)
- Critical safety/auth context that's small

**Gets extracted to `/docs/<topic>.md`:**
- Procedural playbooks (how to add a migration, how to deploy, how to add a feature flag)
- Pattern explanations (deferred loading, caching strategy, error handling conventions)
- Architecture deep-dives (how the rendering pipeline works)
- Anything longer than ~5 lines that Claude only needs sometimes

The test: *"Will Claude need this on the very next turn for an arbitrary task in this repo?"* If yes, keep inline. If only sometimes, extract and link.

## Workflow

### 1. Detect mode

- If `CLAUDE.md` exists and is **>~120 lines or visibly procedural-heavy** → **audit/refactor mode**
- If `CLAUDE.md` does not exist or is nearly empty → **bootstrap mode**
- If `CLAUDE.md` exists, is short (<~80 lines), and mostly hard rules / pointers → **healthy, don't over-edit mode**

If unsure, read the file and count lines + skim for procedural blocks (lists of steps, code examples >5 lines, "how to X" sections).

### 2. Audit/refactor mode

1. Read the current `CLAUDE.md` end-to-end.
2. Walk through it section by section and classify each block as **keep**, **extract**, or **drop** (redundant / outdated / already obvious from code).
3. Show the user the classification plan **before** writing files. A short table is fine:
   ```
   - Hard rules (lines 1-30) → keep
   - "How we do deferred loading" (lines 31-90) → extract → /docs/deferred-loading.md
   - "Test layout" (lines 91-140) → extract → /docs/testing.md
   - Old TODO list (lines 141-160) → drop (stale)
   ```
4. After the user confirms, create each `/docs/<topic>.md` file with the extracted content, lightly cleaned up (preserve the user's voice — don't rewrite in your own style).
5. Rewrite `CLAUDE.md` as a lean index. See `CLAUDE-MD-TEMPLATE.md` for the shape and pointer-line anatomy.
6. Preserve any `@import` lines or special tooling references the user has — they may be load-bearing. Ask before removing any.

### 3. Bootstrap mode

1. Explore the repo to learn what's actually here. Look at `package.json` / `pyproject.toml` / `Cargo.toml` / `Gemfile`, the top-level dir layout, the README, any existing `/docs`, the test setup, and 2–3 representative source files. **Explore proportionally** — your goal is to identify topics worth documenting, not to produce a complete codebase map. Stop reading once you have enough to draft a plan; depth comes later if a specific topic warrants it.
2. Identify pattern-worthy topics. Common ones: testing conventions, build/deploy, auth flow, DB / migration playbook, caching or deferred-loading patterns, error handling, env setup, code style quirks.
3. Propose a plan to the user **before generating files**: which `/docs/<topic>.md` files you'd create and a one-line description of each. Let them prune or add.
4. Generate `/docs/<topic>.md` files. Keep them concrete — show the actual pattern as it exists in the repo, with file path references (e.g., `src/lib/cache.ts:42`).
5. Generate a lean `CLAUDE.md` with hard rules + the index of pointers.

### Verify-before-document

Before writing about a class, function, job, command, or file, **confirm it actually exists**. READMEs and old comments often reference things that were renamed, removed, or never built. A doc that confidently describes a fictional `Sync::PullJob` is worse than no doc — it makes future Claude sessions act on phantom code.

Cheap check: grep for the symbol or `ls` the path. If a referenced thing doesn't exist, don't document it as if it does — either flag it for the user as "README mentions X but I couldn't find it" or omit it entirely.

### Non-interactive fallback

If there's no interactive user available (you're running as part of an automated workflow, or the caller said "just do it"), don't block on confirmation. Write the plan to `plan.md` at the repo root (or alongside your other outputs), then proceed. The plan file becomes the user's review surface after the fact.

### 4. Healthy mode

If the file is already lean and pointer-based, say so plainly. Optionally suggest 1-2 small tweaks if you spot something. **Do not** restructure for the sake of restructuring — over-editing a healthy file destroys the user's voice and wastes effort.

## Output formats

- **CLAUDE.md** has a consistent shape across repos — see `CLAUDE-MD-TEMPLATE.md` for the skeleton and the pointer-line anatomy.
- **`/docs/<topic>.md` files** don't have one canonical shape — a migrations playbook reads differently from a pattern explanation, which reads differently from a glossary. Let the content drive the structure. The principles below apply to all of them.

### Topic-doc principles

- **Lead with a 1-2 sentence summary** of what the doc covers, so Claude can decide quickly whether to keep reading.
- **Be concrete.** Reference real files and line numbers (`src/lib/loader.ts:88`) instead of abstract descriptions.
- **One topic per file.** If a doc is growing past ~300 lines, split it further and add a small index at the top.
- **Match the shape to the content.** Playbooks want numbered steps. Pattern explanations want a "the pattern" + "when to use it" + "gotchas" rhythm. Reference docs want tables or definition lists. Pick what fits — don't force a template.

## Things to be careful about

- **Don't invent conventions.** In bootstrap mode, only document patterns you actually verified by reading the code. If the repo doesn't have a deferred-loading pattern, don't write a doc claiming it does. README claims and old code comments are not verification — grep for the actual symbol.
- **Preserve the user's voice.** When extracting, don't rewrite their phrasing into your own. Lightly clean formatting and remove obvious cruft, but the content stays theirs.
- **Don't drop content silently.** If you think a section is stale or redundant, flag it for the user rather than deleting it unilaterally.
- **`@import` lines and tool-specific syntax** (e.g., `@RTK.md` style imports, MCP-specific blocks) may be load-bearing. Treat them as keep-by-default and ask before changing.
- **The user might already have `/docs/`.** Check before writing — append to or update existing files rather than clobbering.
- **Healthy files exist.** If CLAUDE.md is already short and pointer-based, the right move is to say so and stop.

## Output expectations

When you finish, tell the user:
- Which files you created or modified (with line counts, e.g., `CLAUDE.md: 180 → 42 lines`)
- What you extracted and where
- Anything you flagged as stale or unclear that needs their judgment
