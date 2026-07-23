---
name: adversarial-review
description: Adversarial code review of a diff using split-context subagents — separate reviewer agents each get ONLY the diff and are told to assume the code is wrong and find the reasons it breaks, findings are then verified against the real code to drop false positives, and reported (fixes applied only on request). Use this whenever the user asks for an adversarial review, wants a diff or set of changes stress-tested for bugs, says "tear this apart", "assume it's broken", "poke holes in this", "find what's wrong with these changes", "red-team this code", or wants a skeptical second pass on code that was just written — even if they don't say the word "adversarial".
---

# Adversarial Review

A code review built on **split context**. The Claude that wrote the code wants it accepted; that bias makes it a poor judge of its own work. So the review is done by separate agents that never see the author's reasoning — only the diff — and are told to assume the code is wrong.

Based on the adversarial review flow from https://bun.com/blog/bun-in-rust#adversarial-review.

## The principle

Three roles, kept apart on purpose:

- **The implementer** wrote the code and holds the plan and the reasoning. It does **not** review.
- **The reviewers** get **only the diff** and one instruction: assume it's broken, find why. They do **not** see the plan, the intent, or the implementer's justifications — that context is exactly what launders a bug into "looks fine."
- **The fixer** applies findings that survived verification. It does **not** review.

You are the orchestrator, not any of these roles. Run in a fresh session (see the first hard rule) so you don't carry the implementer's framing — then your job is to coordinate: spawn the reviewers, verify what they find, and write the report. Keep the *finding* of bugs in separate reviewer subagents that see only the diff, so no single reviewer's blind spot decides the outcome.

## Hard rules

- **Run in a separate session from the one that wrote the code.** This is the load-bearing rule; the rest only matter if it holds. The orchestrator doesn't merely spawn reviewers — it authors their prompts, judges which findings are real, and writes the report. Every one of those is judgment the implementer is biased on. A context that just wrote the code will hand over a softened framing, and — the real damage — overrule a correct finding at the verification step ("no, I handled that"), so the bug ships even though a fresh reviewer caught it. Fresh reviewers cannot save a review whose *judge* is the author. A new session, pointed at the diff (a branch, PR, or `git` range — never the plan or the reasoning), removes that bias at its root. **If you are invoked in the same session that wrote the code under review, stop.** Tell the user to re-run `/adversarial-review` in a fresh session pointed at the diff, and do not proceed. (The only exception is a diff this session did not author — e.g. reviewing someone else's branch you just checked out; then there's no implementer bias to escape.)
- **Reviewers see the diff, not the story.** When you spawn a reviewer subagent, give it the diff and the minimum needed to read it (language, file paths). Do **not** paste the plan, the PR description, your reasoning for the change, or "what this is supposed to do." The blind spot is the whole point — an agent told the intent will rationalize the code toward it.
- **At least two reviewers, independent.** Spawn 2+ reviewer subagents that cannot see each other's output. Overlap is fine; corroboration and divergence are both signal.
- **Every finding is verified before it reaches the user.** "Assume the code is wrong" reliably produces false positives — that's the deliberate cost of the framing. A finding only survives if it's confirmed against the actual code: you can name the file, the line, and the concrete input or state that triggers the wrong behavior. Unverifiable suspicions are dropped, not hedged into the report.
- **Report by default; fix only on request.** The output is a list of verified findings. Do not edit code, commit, or push unless the user explicitly asks for the fixer pass after seeing the findings.

## Workflow

### Phase 1 — Get the diff

Establish what's under review, in order of preference:
- The user named a range / branch / PR — use it (`git diff <base>...HEAD`, `gh pr diff <n>`, or the GitHub MCP).
- Uncommitted work — `git diff` plus `git diff --staged`.
- If it's genuinely ambiguous what the diff should be, ask once, then proceed.

Capture the diff text and the list of changed files with line ranges. You'll need the real files (not just the hunks) in Phase 3.

### Phase 2 — Fan out blind reviewers

Spawn **2 or more** reviewer subagents in parallel — a single message with multiple Agent calls, so they run concurrently and can't see each other. Each gets the **diff only** plus the language and file paths. Give each this instruction as its task:

> You are reviewing a code change adversarially. Assume the code is **wrong** and your job is to find the bugs and the concrete reasons it does not work. Hunt for: memory-safety violations, use-after-free, resource leaks, logic errors, off-by-ones, unhandled error paths, null / empty / negative edge cases, race conditions, and semantic mismatches — where the code does something subtly different from what the surrounding names and signatures imply. For each issue: name the file and line, state the specific input or state that triggers it, and explain the wrong outcome. Do not comment on style. Do not praise. Return only a list of suspected defects — it is fine to be aggressive, false positives get filtered afterward. You are seeing only the diff; do not ask for more context, work with what a hostile reviewer could infer from the change itself.

Optionally give each reviewer a distinct lens so they cover different failure modes instead of piling onto the same obvious one — e.g. one on memory / lifetimes / resources, one on logic / edge-cases, one on contract / semantic mismatch. Keep the "assume it's wrong, diff-only" framing identical across all of them; only the emphasis changes.

Collect every raw suspected defect. Do not filter yet.

### Phase 3 — Verify (drop the false positives)

This is the step that makes the aggression safe. For each raw finding, confirm it against the **actual code** — the full changed file and the code it interacts with, not just the diff hunk the reviewer saw. A finding survives only if you can state, concretely:

- the file and line,
- the specific input or state that reaches it,
- the wrong outcome that results.

Drop anything that turns out to be: a pre-existing issue not introduced by this diff, already guarded in code the reviewer couldn't see, intentional and correct, or something a compiler / linter / type-checker would catch on its own. When two reviewers reported the same defect, merge them into one finding.

For a large batch, delegate verification to subagents (one per finding, or one per file) — but the verifier must read the real code and return a confirmed / rejected verdict with the evidence line. Uncertain is not confirmed; if it can't be verified, it doesn't ship.

### Phase 4 — Report

Output the surviving, verified findings, most severe first:

```markdown
# Adversarial Review

**Diff:** <range / PR / working tree> — <n> files
**Reviewers:** <count> · **Raw findings:** <r> · **Confirmed:** <c>

## Confirmed findings

### <short, specific title>
**File:** `path:line`
**Trigger:** <the input or state that reaches the bug>
**Outcome:** <what goes wrong>

\`\`\`<lang>
<the actual offending code>
\`\`\`

**Suggested fix:** <concrete direction; snippet if it clarifies>

---

(repeat per finding)

## Dropped
<one line each for the notable false positives the reviewers raised, and why they were dropped — so the user sees the coverage, not just the survivors. Skip if there's nothing worth noting.>
```

If nothing survived verification, say so plainly — a clean adversarial pass is a real result, not a failure of the skill. Never invent findings to fill the report; a fabricated bug destroys trust in every real one.

### Phase 5 — Offer the fixer (only now)

After delivering the report, ask whether to apply the fixes. Only if the user says yes, run the fixer pass: apply the validated suggestions, keeping each change scoped to its confirmed finding — don't fold in unrelated cleanups. After fixing, re-check that each applied change actually resolves its finding.

Do not fix, commit, or push before the user asks.

## Notes

- This skill reviews a **diff**, and is deliberately narrow: adversarial bug-hunting via split context. It is not a full PR review — no intent-gathering, no severity taxonomy, no posting to GitHub. For that, use `/pr-reviewer`. For a broad multi-agent pass with cloud verification, `/code-review ultra` already exists; this skill is the lightweight, local, blog-faithful version you can run inline the moment code is written.
- The most common way to weaken it is leaking context to the reviewers. If you catch yourself "helpfully" telling a reviewer what the code is meant to do, stop — that framing is exactly what hides the bug.
