---
name: qa
description: Verify a suite's behavioral intent by executing qa-plan.md in a plan-blind session. Reads ONLY qa-plan.md (and context.md) — never plan.md, visual.html, or the diff — then verifies each B-n/R-n criterion against the running code. Writes real test files when the repo has a test setup; otherwise performs manual verification and reports a checklist. Run it in a fresh session with `claude --model sonnet "/qa <suite-dir>"`. Use when the user invokes /qa <suite-dir>, or asks to "QA the plan", "verify the intent", or "test what we asked for, not what we built".
---

# /qa

Verify that the software does what the user **asked for** — not what the plan said to build. This session is deliberately blind to the plan: the criteria in `qa-plan.md` were authored from intent alone, and this skill checks them against the real, running code. Divergence between the two is exactly the signal the pipeline exists to surface.

## Usage

`/qa <suite-dir>`

Designed to run in a fresh session on Sonnet after `/build` finishes — `/blueprint` and `/build` both print the exact command.

## Blindness — hard rule

You may read, from the suite dir, **only** `qa-plan.md` and `context.md`. You must NOT read:

- `plan.md` or `visual.html`
- the git diff, `git log` of the implementation, or any commit produced by the executor
- any proposal or critique artifact

If you catch yourself wanting to know *how* something was implemented, stop — that curiosity is the bias this skill exists to exclude. You interact with the code only as its user does: run it, call it, test it from the outside. Reading application source is allowed **only** to the minimum extent needed to wire tests (find the test dir, the entrypoint to invoke, the fixture conventions) — never to learn the implementation approach and never to adjust a criterion to match what was built.

## Phases

### Phase 1 — Read

Read `<suite-dir>/qa-plan.md` as your first action. Validate it against `skills/blueprint/QA-FORMAT.md`: YAML frontmatter with `artifact: qa-plan`, `## Intent`, and at least one `B-n` criterion. If missing or malformed, stop and tell the user to re-run `/blueprint`'s QA stage. Optionally read `context.md` for intent background. Read `CLAUDE.md` at the project root for project conventions (test commands, tooling).

### Phase 2 — Detect the test setup

Determine whether the repo has a real test setup: a test script or config (`package.json` scripts.test, `pytest.ini`/`pyproject.toml`, `Gemfile` with rspec, `go test` layout, etc.) and an existing test directory with conventions to follow.

- **Test setup found → test mode.** Criteria become real, committed-style test files.
- **No test setup → manual mode.** Criteria are verified live and reported as a checklist; do not scaffold a test framework into a repo that has none.

Print which mode was detected and why, then proceed.

### Phase 3 — Verify

**Test mode:**

1. For each `B-n` and `R-n` criterion, write a test that expresses its stimulus → observation pair, following the repo's existing test conventions (location, naming, fixtures, style). Name or annotate each test with its criterion ID so the mapping is greppable.
2. Tests assert the observable contract from the criterion — endpoints, CLI output, UI state, exit codes — never internal functions you'd have to read the implementation to know about.
3. Run the new tests (delegate to the project's test runner conventions). A failing test is a **finding, not a defect in the test** — first re-check the test faithfully encodes the criterion; if it does, the behavior diverges from intent and gets reported. Fix your own test code freely; never "fix" a test by weakening the criterion, and never touch application code.

**Manual mode:**

1. For each criterion, perform the `verify:` line live where possible — send the request, run the command, drive the UI — and record what actually happened.
2. Where live verification isn't possible in this environment, mark the criterion `unverified` with the exact steps a human should perform.

### Phase 4 — Report

Print:

```
QA report — <suite-dir>
Mode: tests | manual

Behavioral criteria:
  B-1 ✅ <criterion>            [test: <path>::<name>]
  B-2 ❌ <criterion> — observed: <what actually happened>
  R-1 ✅ <criterion>

Coverage: <n>/<total EB-n> expected behaviors covered
Unverified: <ids + steps for a human, if any>

Test files written:
  - <path>   (test mode only)
```

For every ❌, state the observed behavior next to the expected one — no speculation about the cause, since you haven't seen the implementation and shouldn't guess at it. Recommend the follow-up plainly: divergence goes back to the implementing session or a `/blueprint` revision; it is not fixed here.

Do not commit. End your turn.

## Constraints

- Never read `plan.md`, `visual.html`, or the implementation diff. Application source only for test wiring, never for approach.
- Never modify application code — not even for an "obvious" one-line fix.
- Never weaken a criterion to make it pass; criteria change only via `/blueprint` revising `context.md` and re-running its blind QA author.
- Test mode only when the repo already has a test setup; never introduce a framework.
- Report divergence factually (expected vs observed); do not diagnose causes you'd need the plan to know.
- Do not commit.
