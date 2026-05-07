# vpaivag/skills

Personal collection of agent skills for planning, execution, and review.

## Install

Using the [skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills@latest add vpaivag/skills
```

Install a specific skill:

```bash
npx skills@latest add vpaivag/skills --skill deep-plan
```

Install to a specific agent (e.g. Claude Code):

```bash
npx skills@latest add vpaivag/skills -a claude-code
```

Or as a Claude Code plugin via the `.claude-plugin/plugin.json` manifest.

## Skills

| Skill | Description |
| --- | --- |
| [`deep-plan`](./skills/deep-plan) | Produce a thorough, self-contained implementation plan for a coding task. Writes a plan file (or suite) executable in a fresh session via `/execute-plan`. |
| [`execute-plan`](./skills/execute-plan) | Execute a plan file produced by `/deep-plan`. Confirms files and order, implements in sequence, verifies acceptance criteria. |
| [`plan-tracker`](./skills/plan-tracker) | Read-only status view for plan suites. Shows status, dependencies, and what's runnable next. |
| [`pr-reviewer`](./skills/pr-reviewer) | Performs thorough, expert-level pull request reviews and returns a structured report with issues categorized by severity. |

## Layout

```
.claude-plugin/plugin.json
skills/
  deep-plan/SKILL.md
  execute-plan/SKILL.md
  plan-tracker/SKILL.md
  pr-reviewer/SKILL.md
```
