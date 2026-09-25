---
name: project
description: Draft a Linear project a team can plan against — one standard format (Problem → Goal → Scope → Out of scope → Risks), two or more features toward one goal, optional milestones as shippable stages, created through the Linear MCP only after the user approves the preview, then every feature handed to /issue. Use when the user invokes /project, asks to create or spec a Linear project, turn a set of related features or a roadmap item into a project, or when /issue flags work as project-sized.
---

# /project

Turn a goal that needs several features into a Linear project the team can plan against: someone who wasn't in this conversation reads the project and knows why it exists, what "done" means, and which features get it there. The format lives in `PROJECT-FORMAT.md` beside this file. The issues inside the project are `/issue`'s job — this skill never writes an issue description.

## Asking questions

Ask via `AskUserQuestion`, recommended option first. If it is unavailable, print the questions as a numbered list with options and wait for the reply.

## Linear vocabulary

Speak Linear — in chat, in questions, and in everything written to Linear. Project, milestone, initiative, lead, issue, parent issue — never epic, roadmap phase, story, or sprint.

## Steps

### 1. Read the input

Take the rough input from the arguments and the conversation — usually a grilling session or a hand-off from `/issue`. State the problem, the goal, and the features that reach it, one line each.

**Size gate:** a project holds two or more features toward one goal. One feature is one issue — however big, however many steps or repos, it is an issue or a parent issue. If the input is one feature, say so, hand off to `/issue`, and stop. Duration never decides the shape.

Done when you can list the features and say why they share one goal.

### 2. Fill the gaps

Ask in batches, skipping anything the input already answers:

1. **Language** — the language of the name and prose.
2. **Team(s)** — from `list_teams`; the lead team first. Skip when the workspace has one team.
3. **Lead and target date** — who owns it and when it should land (a month or quarter is fine). Either may stay unset.
4. **Gaps** — only what the Required sections or the features cannot be written without: the success signal, each feature's observable outcome, the order features must ship in.

When the input came without a prior grilling session and the features are still vague, keep asking batches until each feature has an outcome someone can observe. Every feature gets drafted into an issue at the end, so it must carry enough context for `/issue`.

Done when every Required section of `PROJECT-FORMAT.md` has material to write from, and every feature has its outcome.

### 3. Look around

- **Overlap:** `list_projects` with the key terms. Surface a likely duplicate or an overlapping project before drafting.
- **Initiative:** `list_initiatives`; propose linking one when the project clearly serves it.
- **Existing issues:** `list_issues` on the key terms. An open issue that already covers a feature is moved into the project instead of drafted again.

Done when overlap is ruled out or confirmed, and each feature is marked new or existing.

### 4. Shape the features

- **Milestones** — only when features ship in stages. Each milestone is a shippable outcome someone can observe, never a layer or a phase ("Backend done", "QA" are not milestones), and each one leaves the system usable. A project whose features ship together has no milestones.
- **Order** — record a **blocks** relation when one feature must land before another.

Done when every feature sits in at most one milestone and its blockers are known.

### 5. Draft

Read `PROJECT-FORMAT.md` now — not earlier, never from memory. Draft the project, then check it against the format's **Required** list and its rules. Ignore Linear project templates; the format is the template.

Show the preview: name, summary, teams, lead, dates, initiative, milestones with target dates, the features (new or existing, with milestone and blockers), and the full description. Revise until the user approves.

### 6. Create

After explicit approval, through the Linear MCP:

- `save_project` with name, summary, description, teams, lead, dates, and initiative. Never pass `template`.
- `save_milestone` for each milestone, in order.
- `save_issue` with `project` (and `milestone`) on each existing issue the user approved moving in.
- Leave priority, status, and labels at their defaults unless the user set them in this conversation.

Print the project URL.

### 7. Hand off to /issue

Invoke `/issue` through the `Skill` tool with every new feature. Pass, for each feature: its outcome and the context gathered here, the project name, its milestone, the chosen language and team, and its blockers among the other features. `/issue` shapes each feature (issue or parent + sub-issues), previews, and creates — its own approval step still applies.

## Constraints

- Linear is written only in Step 6, after the user approves the preview; issues only through `/issue` in Step 7.
- This skill never drafts issue descriptions; `ISSUE-FORMAT.md` belongs to `/issue`.
- One feature never becomes a project.
- Every project passes the `PROJECT-FORMAT.md` Required list before it is shown.
