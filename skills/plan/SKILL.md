---
name: plan
description: Single front-door planning skill that takes a coding task from stated intent to an approved, executable plan suite. Gathers context (restate → explore fan-out → batched Q&A → persist context.md), gates on whether a genuine design choice exists, and scales accordingly — mechanical tasks get a direct plan, design tasks get 2–3 independent proposals red/blue-critiqued by plan-critic agents before the user selects. Writes a suite (context.md, plan.md, blind qa-plan.md, visual.html) under the configured plans directory (default `.claude/plans/`) and ends with handoff commands for /execute-plan and /execute-qa. The visual.html is the review surface — the user approves or flags the plan in the page. Use when the user invokes /plan, asks to plan a task or feature, wants a quick or deep or thorough plan, asks to "gather context before implementation", or wants a checkpoint before coding. Replaces the retired /intake, /simple-plan, and /deep-plan.
---

# /plan

Take a task from stated intent to an approved, executable plan suite in one session. The suite is consumed by fresh sessions downstream: `/execute-plan` implements `plan.md`, `/execute-qa` verifies `qa-plan.md` without ever reading the plan.

The skill scales to the task through a gate, not through separate skills: mechanical work gets a short direct path, work with a genuine design choice gets independent proposals and adversarial critique before the user picks a direction.

**Run this skill on a strong model** (Opus or Fable). Do not pin it in frontmatter — a pin is absolute and would downgrade stronger sessions; the declared agents pin their own models per role.

## Asking questions

This skill prefers the `AskUserQuestion` tool for interactive prompts. If `AskUserQuestion` is not available (older Claude Code versions, restricted environments), fall back to plain text: print the question, list the options as a numbered list with the recommended option marked `(Recommended)`, and wait for the user's reply (a number or the option label). The skill proceeds normally in either mode — every call site below that says "call `AskUserQuestion`" follows this fallback rule.

## Plans directory

Resolve the plans directory before any path-touching action: read `.claude/plans-config.json` if present and use its `plansDir`; otherwise default to `.claude/plans`. The config also carries a `gitignore` boolean (default `true`) — only manage `.gitignore` when that flag is true. If the config file is missing or malformed, silently fall back to the defaults. Everywhere this skill says "the plans directory" or `<plansDir>` below, it means the resolved value.

## Project conventions

Before Explore, read `CLAUDE.md` at the project root if it exists. It contains references to other documentation — follow those references and read the linked docs. Treat `CLAUDE.md` and its referenced docs as authoritative project context that must be honored in the plan.

## Operating mode

- **Read-only on code.** During every stage, code access is `Read`, `Glob`, `Grep`, and read-only `Bash` (e.g. `git log`, `git diff --stat`, `ls`). The only writes are the suite directory contents, an optional `.gitignore` append, and — only on the mechanical path's "implement now" option — the code edits the user approved.
- **The orchestrator owns the conversation.** Subagents cannot call `AskUserQuestion`; all Q&A, the gate decision, proposal selection, and approval happen in this session. Subagents earn their isolation through parallelism (explore fan-out) or deliberate blindness (proposal authors, `plan-critic`, `qa-author`).
- **The suite directory is the interface between agents.** Subagents read and write files in the suite dir; do not paste large artifacts between prompts when a file path will do.
- **Do not auto-invoke `/execute-plan`, `/execute-qa`, or any other skill.** The handoff is the user's job — fresh sessions keep the executor's and QA's context clean.

## Stages

Execute these stages in order. Do not skip ahead.

### Stage 1 — Restate (or ask for a task)

Read the user's task description.

- **If `/plan` was invoked with no task description** (or one so empty it conveys no intent), stop and reply with a short line asking for the task — e.g. "Give me something to plan — what are you trying to do?" — then end the turn. Do not touch the codebase. Do not create any directory.
- **Otherwise**, restate the task in one short paragraph in your own words. Do not editorialize — just reflect the task back so the user can correct misreadings before any exploration.

### Stage 2 — Explore

Explore the codebase to resolve everything code can settle, **before** asking the user anything beyond their initial statement. Fan out per the delegation rules: for anything non-trivial, spawn multiple narrow read-only Explore subagents in parallel — one per sub-area the task touches — each with a precise question and the files it should focus on. Require evidence (file paths + line references); treat any claim without a specific file/line as unverified. Cross-check critical paths with overlapping agents rather than trusting one sweep.

Exploration is bounded by the stated task. Do not roam the repo "just to understand it" — every read or agent should retire a question you would otherwise ask the user.

### Stage 3 — Batched Q&A

Collect everything code could not answer — intent ambiguities, scope edges, priorities, tradeoffs, constraints not visible in the repo — and ask it in **one `AskUserQuestion` call** (up to the tool's per-call limit; overflow goes into a single follow-up call). For each question provide the reasonable default you'd otherwise have assumed as the first option, labeled `(Recommended)`. Do not drip questions one at a time, and do not ask what code already answered — inline the substitution instead ("Resolved via `src/router.ts:42` — already handles auth").

While asking, make sure you can state the task's **expected behavior**: the user-visible outcomes, observable from outside the code. These become the `EB-n` items in `context.md` and are the only thing QA will ever see — if you can't write them implementation-free, ask until you can.

### Stage 4 — Gate

Classify the work. Recommend the **design path** if any one of these fires; otherwise the **mechanical path**:

1. **Hard-to-reverse** — touches database schema, public API contracts, file formats, persisted data, or is otherwise costly to roll back. Migrations almost always trip this even when they look mechanical.
2. **Surprising-without-context** — a future reader will plausibly ask "why was this done this way?" — the decision warrants documentation.
3. **Real-tradeoff** — 2 or more genuinely viable approaches exist with different complexity / performance / maintainability profiles.
4. **Cross-concern** — the task spans multiple distinct kinds of change that each deserve their own consideration (migration + model + serializer, backend + frontend + tests of different shapes). Uniform bulk work does **not** count — a 30-file rename is one kind of work repeated. File count is never a criterion.

The honesty rule from the old design stage still governs: if you find yourself manufacturing a weak alternative just to justify the design path, that's the signal there is only one viable approach — take the mechanical path and document the rejected non-starters in one sentence each.

Print the classification and which criterion fired (or "mechanical — no gate criterion met"), then confirm via `AskUserQuestion`: "Proceed on the <path> path?" with options "Proceed (Recommended)", "Use the other path", "Cancel". On Cancel, stop — nothing has been written yet.

### Stage 5 — Persist context

1. Compute timestamp via `date +%Y-%m-%d-%H%M%S`.
2. Derive a kebab-case slug (≤6 words) from the task essence.
3. Create the suite dir: `mkdir -p <plansDir>/<timestamp>-<slug>/`.
4. If the config's `gitignore` flag is true (default), and a `.gitignore` exists at the project root that does not already contain `<plansDir>/`, append `<plansDir>/` to it. If `.gitignore` does not exist, create it with that single line. Check before appending to avoid duplicates. If `gitignore` is false, skip this step.
5. Read [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md) **now — not earlier, never from memory** — then write `context.md` in exact compliance: same frontmatter keys, same section names, same `EB-n` ID scheme. The format is a contract, not inspiration. After writing, re-check the file against the format's Required list and fix any deviation before proceeding. The `## Expected behavior` section must be implementation-free — it is the blind QA author's entire world.

**Immediately after writing `context.md`, spawn the `qa-author` agent in the background.** Pass it only the path to `context.md` and the suite dir to write into. It runs while the remaining stages proceed — its input never changes with the design work, so there is nothing to wait for. If a later revision changes `context.md`'s Task or Expected behavior, re-run it.

### Stage 6 — Proposals & critique (design path only)

Skip this stage entirely on the mechanical path.

1. **Proposals.** Spawn 2–3 proposal-author subagents in parallel, each assigned a genuinely different angle on the problem (e.g. minimal-change-first, robustness-first, leverage-existing-infra). Each gets `context.md` plus the Stage 2 findings, works independently — none sees the others — and returns a named proposal: approach summary, files touched, tradeoffs, reversibility. If two angles converge on the same design, collapse them; do not present duplicates as choice.
2. **Red/blue critique.** For each proposal, spawn a `plan-critic` agent. Each critic receives **one proposal and the constraints from `context.md` — not the codebase, not the other proposals** — and returns attacks that survive its own blue-team repair attempt, with severity.
3. **Select.** Present each proposal with its surviving critiques, recommend one with the reasoning, and ask via `AskUserQuestion` which to plan — recommended option first, one option per proposal, plus "Cancel". On Cancel, delete the suite dir and stop.

### Stage 7 — Specify

Read [PLAN-FORMAT.md](./PLAN-FORMAT.md) **now — not earlier, never from memory** — then write `plan.md` in exact compliance with its schema, and re-check the written file against its Required list before proceeding. Key rules the plan must honor:

- Pure text — no diagrams; visuals belong to `visual.html`.
- Ordered steps grouped into phases with natural checkpoints. Small plans have one phase.
- On the design path, summarize the losing proposals and their decisive critiques into `## Alternatives considered` — the raw intermediates are not persisted.
- Acceptance criteria (`AC-n`) are mechanical only: compiles, migration runs, tests pass. Behavioral verification is `qa-plan.md`'s job — keep it out of the plan.
- Follow the code-in-plans rule strictly: interfaces and intent, not implementation bodies.

### Stage 8 — Visual

First confirm `qa-plan.md` landed from the Stage 5 background spawn; if that agent failed, re-run it now (still passing only `context.md`).

Then spawn the `visual-planner` agent with the suite dir path. It always runs; its depth scales with the plan — a mechanical plan gets a thin render (file map, phases, review controls), a design-heavy plan gets the full block set (wireframes, contract diffs, diagrams, option comparison). It renders the **whole suite**, `qa-plan.md` included: the QA section shows the behavioral criteria and an `EB-n` coverage map so the user can check that blind QA captured their intent and spot drift between plan and QA. It writes `visual.html` beside the plan. The renderer **adds form, never facts**: if it reports something missing from `plan.md`, fix the plan and re-render — never let content exist only in the HTML. (Rendering plan and QA side by side does not break blindness — blindness constrains who *authors* and who *executes* QA, not what the human reviews.)

### Stage 9 — Review & approve

Print:

```
Suite ready: <suite-dir>
  plan.md      — the executable plan
  qa-plan.md   — behavioral criteria, authored blind
  visual.html  — review surface

Open visual.html in your browser to review. Approve or flag sections there,
then come back here — I'll pick up review.json automatically, or paste the
copied feedback if your browser can't write it.
```

Then wait for the user. On their next message:

1. If `<suite-dir>/review.json` exists, read it — it carries the verdict and any flagged sections with notes. Otherwise use the pasted feedback or whatever the user typed.
2. **On flags/revisions:** update `plan.md` in place (re-exploring read-only first if needed), regenerate `visual.html` wholesale via `visual-planner` — never hand-patch it — and, only if the revision changed `context.md`'s Task or Expected behavior, update `context.md` (appending `EB-n`, never renumbering) and re-run `qa-author`. **Flags on the QA section always take this second route:** treat them as corrections to `## Expected behavior`, fix `context.md`, and re-run `qa-author` — never write or edit criteria in `qa-plan.md` yourself, or the planner's bias leaks into QA. Then return to the start of this stage. Loop until approve or discard.
3. **On discard:** delete the suite dir (`rm -rf <suite-dir>`) and confirm with one line.
4. **On approve — mechanical path only:** ask via `AskUserQuestion` whether to implement now, with options "Show handoff commands (Recommended)", "Implement now in this session". In-session implementation follows the plan's phases in order, never reorders or skips steps silently, walks the `AC-n` checklist at the end (✅/❌ per criterion, never claiming completion with a ❌), and does not commit. Even after implementing in-session, print the QA and review handoffs — QA must still run in a fresh session precisely because this session is now biased by its own implementation.
5. **On approve** (design path, or mechanical with handoff chosen), print:

```
Plan approved: <suite-dir>

Run in fresh sessions, in order:
  claude --model sonnet "/execute-plan <suite-dir>/plan.md"
  claude --model sonnet "/execute-qa <suite-dir>"

Then, for a skeptical pass on the diff:
  claude "/adversarial-review"
```

End the turn.

## Constraints

- Do not touch the codebase before Stage 1 has yielded a stated intent. Exploration is bounded by the stated task.
- Prefer reading code over asking; batch what must be asked. Never drip questions one at a time.
- Do not create the suite directory before Stage 5 — cancel or abandonment mid-Q&A leaves nothing behind.
- `qa-author` receives the `context.md` path and nothing else — never the plan, proposals, critiques, or findings. If its output names internal functions or files, the blindness leaked; regenerate.
- `plan-critic` agents receive one proposal each — never the codebase or sibling proposals.
- `visual.html` is a projection: regenerated wholesale on every revision, never hand-edited, never the only home of a decision.
- **Formats are contracts, delivered just-in-time.** Read the relevant `*-FORMAT.md` immediately before writing its artifact — never earlier in the session, never from memory — and validate the written file against the format's Required list. Inventing your own template shape is a defect, not a style choice.
- Do not print handoff commands before approval. Do not auto-invoke downstream skills.
- No manufactured strawmen: a padded alternatives list is a signal to take the mechanical path, not a design review.
