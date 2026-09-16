---
name: issue
description: Draft a Linear issue that a dev or coding agent can pick up cold — one standard format (Context → Acceptance → Out of scope → Pointers → References), language chosen per issue, cross-layer features shaped into a parent with per-layer sub-issues, created through the Linear MCP only after the user approves the preview. Use when the user invokes /issue, asks to write, create, or file a Linear issue or ticket, turn a bug report or feature idea into a ticket, or break a feature into sub-issues.
---

# /issue

Turn rough input into Linear issues that stand alone: a dev or an agent with no access to this conversation reads the issue, opens the repo, and finishes the work. The format lives in `ISSUE-FORMAT.md` beside this file.

## Asking questions

Ask via `AskUserQuestion`, recommended option first. If it is unavailable, print the questions as a numbered list with options and wait for the reply.

## Linear vocabulary

Speak Linear — in chat, in questions, and in everything written to Linear. When a Jira or Scrum term comes to mind, use its Linear counterpart:

| Reaching for | Say |
|---|---|
| Epic | **Project** (multi-week, milestones) or **parent issue** (one feature across a few layers) |
| Story, user story, ticket | **Issue** — a plain task title, never "As a user I want…" |
| Subtask | **Sub-issue** |
| Sprint | **Cycle** |
| Story points | **Estimate** |
| Dependency | **Blocks** / **blocked by** relation |
| Theme | **Initiative** |
| Grooming, refinement | **Triage** |

## Steps

### 1. Read the input

Take the rough input from the arguments and the conversation. Classify it as **Bug**, **Feature**, or **Improvement**, and note which layers it touches (api, web, app, edge, infra…).

Done when you can state the type, the layers, and the outcome in one sentence each.

### 2. Ask one batch

Send a single `AskUserQuestion` call with up to four questions, skipping any the input already answers:

1. **Language** — the language of the title and prose (English / Español / other).
2. **Team** — from `list_teams`; skip when the workspace has one team.
3. **Gaps** — only what Acceptance cannot be written without: for a bug, the reproduction and expected behavior; for a feature, the outcome the user or caller observes.

Done when every Required section of `ISSUE-FORMAT.md` has material to write from.

### 3. Look around

- **Duplicates and blockers:** `list_issues` with a `query` on the key terms, in the chosen team. Surface a likely duplicate to the user before drafting; record any open issue this work depends on as a blocker.
- **Pointers:** when the current repo holds the code this issue touches, search it for the files and existing patterns the implementer should reuse or the suspected cause of a bug. Cite paths you actually opened.

Done when duplicates are ruled out or confirmed, and each Pointer is a path you verified exists.

### 4. Shape the work

The input may hold more than one effort — a short-term fix and a longer-term redesign, say. Shape each effort on its own, and state every shape by its Linear name with its reason:

- **Single issue** — a bug, or work confined to one layer that fits one PR.
- **Parent issue + sub-issues** — a feature spanning two or more layers or owners. One sub-issue per layer; the layer that defines a contract (usually api) **blocks** the layers that consume it. Propose this shape and let the user confirm or collapse it into one issue.
- **Project** — multi-week work with milestones. Say so and ask whether to continue with a parent issue + sub-issues for its first slice.

Link separate efforts with a **related** relation, or **blocks** when one must land before the other.

### 5. Draft

Read `ISSUE-FORMAT.md` now — not earlier, never from memory. Draft every issue in the chosen shape, then check each one against the format's **Required** list and its rules.

Show the preview for each issue: title, team, labels, parent, relations, and the full description. Revise until the user approves.

### 6. Create

After explicit approval, create through the Linear MCP `save_issue`:

- Create the parent first, then each sub-issue with `parentId`.
- Set `blockedBy` / `blocks` / `relatedTo` for the recorded relations, including between sub-issues and between separate efforts.
- Apply labels by matching the type and layers against `list_issue_labels` for the team; use only labels that already exist.
- Attach reference URLs through `links`.
- Leave estimate, assignee, priority, cycle, and status at their defaults unless the user set them in this conversation.

Print each created issue's identifier and URL.

## Constraints

- Linear is written only in Step 6, after the user approves the preview.
- Estimates are never set.
- Every issue passes the `ISSUE-FORMAT.md` Required list before it is shown.
