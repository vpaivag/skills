---
name: intent-review
description: Intent review of a PR or diff — checks that what was requested is what was built. Breaks the request (a Linear issue, a context.md, or the user's own prompt) into numbered asks the user confirms, traces each ask against the diff with file:line evidence (done / partial / missing / drifted), flags violated constraints and unrequested changes, verifies every gap against the real code, and reports. The PR description and commit messages are the author's story, never the request. Use when the user invokes /intent-review, asks whether a PR or branch does what the issue or ticket asked, wants a diff checked against the request or its acceptance criteria, or asks "did this miss anything from what was asked?".
---

# /intent-review

Check that a diff delivers **what was requested** — every ask, every constraint, nothing silently dropped or reinterpreted. Built on **split context**, the mirror image of `/adversarial-review`: there the reviewers see the diff and never the intent; here they see the request and the diff, and never the author's story.

## Usage

`/intent-review <diff> [request]`

- `<diff>` — a PR number or URL, a branch, or a git range.
- `[request]` — a Linear issue ID or URL, a path to a `context.md`, or the request text pasted in.

Built for PR review, so it runs in a fresh session.

## The principle

Two sources, kept apart on purpose:

- **The request** — what the requester asked for, in their own words: an issue, a `context.md`, a prompt. This is the only yardstick.
- **The author's story** — the PR description, commit messages, code comments explaining the approach, the implementing session's reasoning. It narrates what the author believes they built; "implements pagination" in a commit message is exactly what makes a hardcoded limit of 50 read as done. The story is never the request and never reaches a subagent.

## Hard rules

- **Run in a separate session from the one that wrote the code.** If this session authored the diff, stop and tell the user to re-run `/intent-review` in a fresh session. (A diff this session did not author — someone else's PR — is fine.)
- **The request comes from the request, never the story.** Read the PR description only to find a linked issue, then read that issue. Subagents receive the request, the confirmed ask list, and the diff — nothing from the story.
- **The user confirms the ask list before anything is traced.** A wrong list makes every verdict after it wrong.
- **Every verdict carries evidence.** `done` needs a `file:line` as much as `missing` needs a reason. A verdict without evidence is unverified, and unverified verdicts don't ship.
- **Report only.** Leave the code, the PR, and the issue untouched: no fixes, no commits, no PR comments, no issue updates. Gaps go back to the author.

## Asking questions

Ask via `AskUserQuestion`, recommended option first. If it is unavailable, print the questions as a numbered list with options and wait for the reply.

## Phases

### Phase 1 — Pin the diff

Resolve `<diff>` to a base and head:

- **PR** — `gh pr view <n> --json baseRefName,headRefOid,files` and `gh pr diff <n>` (or the GitHub MCP). Fetch the head with `git fetch origin pull/<n>/head` so full files are readable via `git show <head>:<path>` without touching the user's working tree.
- **Branch** — `git diff <default-branch>...<branch>`.
- **Range** — use it as given.
- **Nothing given** — ask which PR, branch, or range.

Fail here, before any subagent exists, if the ref doesn't resolve or the diff is empty. Capture the diff and the changed-file list.

### Phase 2 — Resolve the request

In order:

1. **The `[request]` argument.** Linear issue → fetch it through the Linear MCP (title + description). `context.md` → read `## Task`, `## Expected behavior` (its `EB-n` items), and `## Constraints`. Pasted text → use it verbatim.
2. **A linked issue.** Scan the PR description and the branch name for issue references only (a Linear ID like `ABC-123`, a Linear URL, `Closes #45`) and fetch the issue. Use nothing else from the description.
3. **Ask.** "What was requested for this change?" — the user can paste the prompt, point to a file, or name an issue.

Keep the request text exactly as sourced; it is the input to Phase 3.

### Phase 3 — Extract the asks (blind to the diff)

Spawn one subagent with the request text only — no diff, no file paths, no PR metadata. An extractor that has seen what was built shapes the asks to fit it. Its task:

> Break this request into atomic, checkable items. Return three lists:
> - **Asks** (`I-1`, `I-2`, …) — each one thing the change must do, phrased as an observable outcome, with the exact quote from the request it comes from.
> - **Constraints** (`C-1`, …) — anything the change must not do or must leave alone: out-of-scope items, "don't touch X", compatibility or performance limits. Quote the source.
> - **Ambiguities** (`?-1`, …) — places where the request supports more than one reading, with the readings spelled out.
>
> Use only what the request says. Implied requirements go under Ambiguities, not Asks. Split compound sentences into separate asks. Do not spawn agents or invoke skills.

### Phase 4 — Confirm the list

Show the user the full list — asks, constraints, ambiguities with their quotes. The user adds, drops, rewords, or resolves each ambiguity into an ask, a constraint, or nothing. Re-show until approved. The approved list is frozen for the rest of the review.

### Phase 5 — Trace

Spawn **2 or more** tracer subagents in parallel — one message, multiple Agent calls, so they can't see each other. Each gets the approved list, the diff, and the head ref so it can read full files with `git show <head>:<path>`. Its task:

> You are checking whether a code change delivers a list of requested items. Work from the diff and the full files at the head ref only; leave PR descriptions, commit messages, and git history unread.
>
> For every ask `I-n`, return one verdict with evidence:
> - **done** — fully delivered. Cite the `file:line` that delivers it.
> - **partial** — started but incomplete: a stub, TODO, hardcoded value, mocked dependency, skipped or missing test for the ask's own behavior, or only some cases handled. Cite where, and name what's missing.
> - **missing** — nothing in the change delivers it. Name where you looked.
> - **drifted** — something was built, but it does a different thing than asked. State "asked: … / built: …" and cite.
>
> For every constraint `C-n`: **respected** or **violated** (cite the violating `file:line`).
>
> Then sweep the diff in reverse: list every hunk that maps to no ask. Mark each **supporting** (needed to deliver an ask — name which) or **unrelated**.
>
> Every item gets a verdict; silence is not a verdict. Do not spawn agents or invoke skills.

For a long list, give each tracer a distinct slice plus one tracer over the whole list, so every ask is still covered twice.

### Phase 6 — Verify

Collect every verdict. Re-check against the full files at the head ref, yourself or via one verifier subagent per finding:

- every `partial`, `missing`, `drifted`, and `violated`;
- every ask where the tracers disagree;
- every `unrelated` hunk.

A gap survives only if you can point at the evidence: the `file:line` (or, for `missing`, the places it would have to live and doesn't). Where the tracers disagree, the code decides. A `done` that fails re-checking becomes the verdict the code supports. Drop what can't be confirmed, and note it under Dropped.

### Phase 7 — Report

```markdown
# Intent review

**Diff:** <PR / branch / range> — <n> files
**Request:** <Linear ID / context.md path / "prompt">
**Asks:** <n> · **Constraints:** <n> · **Tracers:** <n>

| ID | Verdict | Item | Evidence |
|---|---|---|---|
| I-1 | ✅ done | <ask> | `path:line` |
| I-2 | 🟡 partial | <ask> — <what's missing> | `path:line` |
| I-3 | ❌ missing | <ask> — <where it would live> | — |
| I-4 | 🔀 drifted | <ask> — asked: … / built: … | `path:line` |
| C-1 | ⛔ violated | <constraint> | `path:line` |
| C-2 | ✅ respected | <constraint> | — |

## Gaps
<one block per non-done / violated item, worst first: the quote from the request, what the code does instead, the snippet>

## Unrequested changes
**Unrelated:** <hunk — file:line — one line on what it does>
**Supporting:** <count, with the asks they serve>

## Dropped
<tracer verdicts that didn't survive verification, one line each. Skip if none.>
```

End with one line: `<done>/<total> asks delivered, <n> constraints violated, <n> unrelated changes`. A fully delivered request is a real result — say so plainly.

Do not commit or post. End your turn.
