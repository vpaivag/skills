---
name: blueprint
description: Front-door planning skill that takes a coding task — a prompt or an issue reference — from stated intent to an approved, executable plan suite. Sizes the task first (too small → offers to implement directly; more than one shippable unit → recommends splitting), grills the dev for edge cases and decisions unless the conversation already holds that discussion, writes context.md and plan.md, has four blind gap-finder goldfish review the plan cold, then a blind qa-author writes qa-plan.md and a script renders visual.html with no agent. Writes the suite under the configured plans directory (default `.claude/plans/`) and ends with handoff commands for /build and /qa. Use when the user invokes /blueprint, asks for a blueprint of a task or issue, asks to plan a task or feature, asks to "gather context before implementation", or wants a checkpoint before coding.
---

# /blueprint

Take a task from stated intent to an approved, executable plan suite in one session. The suite is consumed by fresh sessions downstream: `/build` implements `plan.md`, `/qa` verifies `qa-plan.md` without ever reading the plan.

This session is the **elephant**: it holds the conversation, the interview, and every decision. The reviewers are **goldfish**: fresh agents that see one artifact and nothing else, so they don't share this session's blind spots. Depth comes from the interview; the goldfish are the second net, never the first.

**Run this skill on a strong model** (Opus or Fable). Do not pin it in frontmatter — a pin is absolute and would downgrade stronger sessions; the declared agents pin their own models per role.

## Asking questions

Ask in plain text, in numbered rounds — never one question at a time when several can be asked now, never a question the code could answer. Format each question as:

```
❓ **Q1** - **<question title>**: <question body, with the options when there are any>

➡️ <your recommended answer>
```

Word each question so "yes" accepts your recommendation. Then wait for the reply.

## Plans directory

Resolve the plans directory before any path-touching action: read `.claude/plans-config.json` **at the project root** if present and use its `plansDir`; otherwise default to `.claude/plans` **relative to the project root** (the repository you are working in). Never resolve either path against the user's home directory — `~/.claude/plans` belongs to Claude Code itself and is always wrong here; suites live inside the repo. The config also carries a `gitignore` boolean (default `true`) — only manage `.gitignore` when that flag is true. If the config file is missing or malformed, silently fall back to the defaults. Everywhere this skill says "the plans directory" or `<plansDir>` below, it means the resolved value.

## Project conventions

Before exploring, read `CLAUDE.md` at the project root if it exists. It contains references to other documentation — follow those references and read the linked docs. Treat `CLAUDE.md` and its referenced docs as authoritative project context that must be honored in the plan.

## Operating mode

- **Old plans are not context.** Never read anything under `<plansDir>` while sizing or exploring, and tell every Explore subagent to exclude it from every search and read. Earlier suites describe plans, not code — some never shipped, some shipped differently. The only suite this skill reads is the one it is writing.
- **Read-only on code.** Code access is `Read`, `Glob`, `Grep`, and read-only `Bash` (e.g. `git log`, `git diff --stat`, `ls`). The only writes are the suite directory contents and an optional `.gitignore` append. The single exception is the short-circuit's "implement directly" answer, which ends the blueprint before anything is written.
- **The orchestrator owns the conversation.** Subagents cannot talk to the user; the interview, triage questions, and approval happen in this session. Subagents earn their isolation through parallelism (explore fan-out) or deliberate blindness (`gap-finder`, `qa-author`).
- **The suite directory is the interface between agents.** Subagents read and write files in the suite dir; do not paste artifacts into prompts when a file path will do.
- **Do not auto-invoke `/build`, `/qa`, or any other skill.** The handoff is the user's job — fresh sessions keep the executor's and QA's context clean. The one exception is the `grilling` skill in Stage 3: its context should carry over, so it runs inside this session.

## Stages

Execute these stages in order. Do not skip ahead.

### Stage 1 — Restate (or ask for a task)

- **If `/blueprint` was invoked with no task** (or one so empty it conveys no intent), reply with one line asking for it — e.g. "Give me something to plan — what are you trying to do?" — and end the turn. Do not touch the codebase. Do not create any directory.
- **If the task is an issue reference** (a tracker identifier like `ABC-123`, or an issue URL), fetch it with whatever fits and is available — a connected tracker MCP (e.g. Linear), `gh issue view` for GitHub, a URL fetch. No tracker is required: if nothing can fetch it, ask the dev to paste the issue. The issue is input, not the plan — it says *what* product-wise; this skill decides *how*.
- Restate the task in one short paragraph in your own words. Do not editorialize — reflect it back so the user can correct misreadings before any exploration.

### Stage 2 — Size

Read `CLAUDE.md` (see Project conventions), then explore just enough to size the task — direct reads, or one or two narrow Explore agents. This is not the deep exploration; it answers one question: is this task the right size for a blueprint?

**These signals mean the task deserves a blueprint** — any one is enough:

1. **Hard-to-reverse** — touches database schema, public API contracts, file formats, persisted data, or is otherwise costly to roll back. Migrations almost always trip this even when they look mechanical.
2. **Surprising-without-context** — a future reader will plausibly ask "why was this done this way?"
3. **Real-tradeoff** — 2 or more genuinely viable approaches exist with different complexity / performance / maintainability profiles.
4. **Cross-concern** — the task spans multiple distinct kinds of change (migration + model + serializer, backend + frontend). Uniform bulk work does **not** count — a 30-file rename is one kind of work repeated. File count is never a criterion.

**Too small.** No signal fires and the change is direct — one obvious touchpoint, an outcome nobody would misread. Print:

```
This task is too small or has a direct solution — we'd be overthinking it. <one-line reason>
```

Then ask: implement it directly, or force the blueprint. Recommend implementing directly. Forcing is always available — the dev may know about something this sizing missed.

- **Implement directly:** the blueprint ends here; nothing is written. Implement the change in this session as ordinary work.
- **Force the blueprint:** continue to Stage 3. If the dev said why they forced it, that reason is the interview's first focus.

**Too big.** The task holds more than one independently shippable unit — pieces that could each merge and deliver value alone. Name the units in one line each and recommend splitting: one issue and one blueprint per unit (via `/issue` sub-issues, or separate `/blueprint` runs). Ask whether to split (recommended), plan only one named unit, or force the whole task. On split, end the turn — nothing is written.

**Right-sized.** Print `Size: blueprint — <the signal(s) that fired, or "right-sized">` and continue in the same turn.

### Stage 3 — Explore & interview

**Explore** to resolve everything the code can settle, before asking the user anything. Fan out per the delegation rules: for anything non-trivial, spawn multiple narrow read-only Explore subagents in parallel — one per sub-area the task touches — each with a precise question and the files it should focus on. Require evidence (file paths + line references); treat any claim without a specific file/line as unverified. Exploration is bounded by the task — every read or agent should retire a question you would otherwise ask the user.

**Interview.** First decide whether the discussion already happened:

- **The conversation already holds it** (the dev grilled the task before invoking `/blueprint`, or a design discussion precedes this turn): summarize the decisions and edge cases you are taking from it, and ask whether to skip the interview. Recommend skipping. Skipping still keeps Stage 5's gap review — the goldfish catch the discussion's blind spots too.
- **Otherwise** — a fresh session, or only a one-line task or a product-level issue: interview the dev with the grilling skill.
  - **If a `grilling` skill is available** in this session (e.g. `mattpocock-skills:grilling`), invoke it through the Skill tool — the installed copy is the one the dev keeps up to date.
  - **Otherwise**, read the vendored [GRILLING.md](./GRILLING.md) **now** and interview the dev by it.

  Either way, its rounds and recommended answers replace this skill's question format for the interview. Facts go to explore subagents, never to the dev; decisions go to the dev. When the interview ends, continue with this skill — grilling settles the understanding, it does not act on it.

The interview is done when you can state, without guessing:

- the **expected behavior** as user-visible outcomes, implementation-free — including the edge and failure cases (these become `EB-n` items and are the only thing QA will ever see);
- what is **out of scope**;
- a **decision** for every Stage 2 signal that fired — the chosen approach and the rejected alternatives, with why.

### Stage 4 — Write the suite

1. Compute timestamp via `date +%Y-%m-%d-%H%M%S`.
2. Derive a kebab-case slug (≤6 words) from the task essence.
3. Create the suite dir: `mkdir -p <plansDir>/<timestamp>-<slug>/`.
4. If the config's `gitignore` flag is true (default), and a `.gitignore` exists at the project root that does not already contain `<plansDir>/`, append `<plansDir>/` to it. If `.gitignore` does not exist, create it with that single line. Check before appending to avoid duplicates. If `gitignore` is false, skip this step.
5. Read [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md) **now — not earlier, never from memory** — then write `context.md` in exact compliance: same frontmatter keys, same section names, same `EB-n` ID scheme. After writing, re-check the file against the format's Required list and fix any deviation.
6. Read [PLAN-FORMAT.md](./PLAN-FORMAT.md) **now — not earlier, never from memory** — then write `plan.md` in exact compliance, and re-check it against the Required list and the line shapes. Key rules: interfaces and intent, never implementation bodies; zero design decisions left to the executor; `AC-n` are mechanical only; at most one mermaid diagram, under `## Architecture`.

Writing the suite is a **waypoint, not a deliverable** — continue to Stage 5 in the same turn.

### Stage 5 — Gap review

Spawn four `gap-finder` agents **in parallel**, one per lens: `edge-failure`, `scope-ambiguity`, `users-data`, `comprehension`. Pass each only the path to `plan.md` and its lens — never `context.md`, the conversation, your findings, or the other lenses.

Triage every finding yourself:

- **The code answers it** → read the code, fix the document.
- **Only the dev can answer it** → collect it for one question round.
- **Noise** → drop it with a one-line reason.

Discipline while triaging — you wrote the plan, so a wish to dismiss a finding is not evidence the goldfish is wrong:

- "This was intentional" is not a reason to drop a finding. If it was intentional, the plan failed to say so — fix the text.
- Never drop a comprehension gap. If a cold reader misread a section, the section is unclear.
- Do not pad the plan only to satisfy a reviewer: fix what changes the build, not what changes the wording.

Ask the collected questions in one round. Then print a short triage summary — fixed, asked, dropped (with reasons) — and route each resolution to where it belongs:

- **Intent-level** (a new edge case, a scope edge, an unclear outcome) → `context.md`: append `EB-n` or extend `## Out of scope`, never renumber. Update `plan.md` if the plan must change too.
- **Plan-level** (ambiguity, a design choice left open, a missing step) → `plan.md`.

If triage changed `## Decisions` or `## Phases` substantially, re-run only the `comprehension` lens once on the revised plan.

### Stage 6 — Blind QA

Spawn the `qa-author` agent and wait for it. Pass it only the path to `context.md` and the suite dir to write into — never the plan, the goldfish findings, or your exploration. It writes `qa-plan.md`. If its output names internal functions or files, the blindness leaked — regenerate.

### Stage 7 — Render

Run the renderer — a script, no agent:

```
sh "${CLAUDE_PLUGIN_ROOT}/assets/visual/render.sh" <suite-dir>
```

If `${CLAUDE_PLUGIN_ROOT}` does not resolve, locate `render.sh` via Glob for `**/assets/visual/render.sh` under the Claude plugin directories (`~/.claude/plugins`). It embeds `context.md`, `plan.md`, and `qa-plan.md` into `visual.html` and copies the runtime assets beside it; the page renders the plan, the QA criteria, and the `EB-n` coverage map in the browser. A section that breaks its format shape renders raw under a warning — if the script or the page shows one, fix the markdown and re-run. Never edit `visual.html` by hand.

### Stage 8 — Review & approve

Print:

```
Suite ready: <suite-dir>
  context.md   — intent and expected behavior
  plan.md      — the executable plan
  qa-plan.md   — behavioral criteria, authored blind
  visual.html  — review surface

Review here, or open visual.html in your browser and approve or flag sections
there — I'll pick up review.json automatically, or paste the copied feedback.
```

Then wait for the user. On their next message:

1. If `<suite-dir>/review.json` exists, read it — it carries the verdict and any flagged sections with notes. Otherwise use the pasted feedback or whatever the user typed.
2. **On flags/revisions:** update `plan.md` in place (re-exploring read-only first if needed). If the revision changes intent, update `context.md` (append `EB-n`, never renumber) and re-run `qa-author`. **Flags on the QA section always take that route:** treat them as corrections to `context.md`, fix it, and re-run `qa-author` — never write or edit criteria in `qa-plan.md` yourself, or the planner's bias leaks into QA. Re-run the renderer, then return to the start of this stage. Loop until approve or discard.
3. **On discard:** delete the suite dir (`rm -rf <suite-dir>`) and confirm with one line.
4. **On approve**, print:

```
Plan approved: <suite-dir>

Run in fresh sessions, in order:
  claude --model sonnet "/build <suite-dir>/plan.md"
  claude --model sonnet "/qa <suite-dir>"

Then, for a skeptical pass on the diff:
  claude "/adversarial-review"
```

End the turn.

## Constraints

- Do not touch the codebase before Stage 1 has yielded a stated intent. Exploration is bounded by the stated task.
- Do not create the suite directory before Stage 4 — a short-circuit, a split, or abandonment mid-interview leaves nothing behind.
- Prefer reading code over asking; ask in rounds, never drip questions one at a time.
- `gap-finder` receives the `plan.md` path and its lens and nothing else. `qa-author` receives the `context.md` path and nothing else. The blindness is the feature — never "help" a goldfish with more context.
- `visual.html` is a projection: produced by `render.sh` from the suite markdown, re-rendered on every revision, never hand-edited, never the only home of a decision.
- **Formats are contracts, delivered just-in-time.** Read the relevant `*-FORMAT.md` immediately before writing its artifact — never earlier in the session, never from memory — and validate the written file against the format's Required list. Inventing your own template shape is a defect, not a style choice.
- **A run is complete only when the suite is complete.** Before ending any turn that isn't a user checkpoint (size decision, interview round, triage round, review verdict), verify the suite contains `context.md`, `plan.md`, `qa-plan.md`, and `visual.html`, and that the Stage 8 review block has been printed.
- **Paths are project-rooted.** All suite paths resolve against the project root, never `~/.claude/`.
- Do not print handoff commands before approval. Do not auto-invoke downstream skills.
