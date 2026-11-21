# BLOCKS — visual.html renderer reference

`visual.html` is produced without an agent. `render.sh <suite-dir>` copies `template.html`, embeds the suite's `context.md`, `plan.md`, and `qa-plan.md` as `<script type="text/markdown">` blocks, copies `blocks.css`, `blocks.js`, and `render.js` beside it, and links the plugin's `mermaid.min.js` when the plan has a mermaid fence. In the browser, `render.js` turns the markdown into the custom elements below; `blocks.js` then upgrades them and adds review mode.

This file is for maintainers. Nobody authors block markup by hand anymore — the markdown shapes in `skills/blueprint/PLAN-FORMAT.md`, `CONTEXT-FORMAT.md`, and `QA-FORMAT.md` are the authoring contract. Changing a shape there means changing its parser in `render.js` in the same commit.

## Markdown → block mapping

| Source | Markdown shape | Emits |
|---|---|---|
| plan `## Context`, `## Approach` | prose | prose |
| plan `## Decisions` | `- (chosen\|rejected) <name> — <why>` | `<option-compare>` / `<option-item verdict name>` |
| plan `## Architecture` | one ` ```mermaid ` fence | `<pre class="mermaid">` |
| plan `## Files changed` | `` - `<path>` (add\|modify\|delete) — <intent> `` | `<plan-filemap>` / `<file-entry path change>` |
| plan `## Phases` | `### Phase <n> — <name>` + numbered steps | `<phase-timeline>` / `<phase-item name>` |
| plan `## Risks & edge cases` | `- (high\|medium\|low) <risk> → <mitigation>` | `<risk-matrix>` / `<risk-item severity mitigation>` |
| plan `## Acceptance criteria` | `- [ ] AC-<n>: <criterion>` | `<ul class="ac-list">` |
| context `## Expected behavior` + qa-plan criteria | `- EB-<n>: …` × `- [ ] B-<n> (covers EB-<n>): …` / `  - verify: …` | `<qa-coverage>` / `<eb-item>` / `<qa-item>` |

Every plan section becomes a `<review-section id="<slug of the heading>" title="<heading>">`, plus a final `qa` section. Ids derive from the heading, so flags survive re-renders.

**Failure is visible, never silent.** A known section whose lines break its shape renders as raw prose under a `.render-warn` box; missing required sections, unknown sections, unrated risks, and a missing `qa-plan.md` are listed in a banner at the top of the page.

Inline markdown supported everywhere: `` `code` ``, `**bold**`, `*em*`, `[text](url)` (http(s), relative, and `#` links only). Block markdown in prose: paragraphs, `-`/`*`/`1.` lists with nesting, fenced code, `###` headings, `>` quotes.

## Blocks (styled by `blocks.css`, upgraded by `blocks.js`)

- `<review-section id title>` — section wrapper; review mode attaches Approve/Flag controls and a note field.
- `<option-compare>` > `<option-item verdict="chosen|rejected" name>` — decision cards; chosen is outlined green.
- `<plan-filemap>` > `<file-entry path change="add|modify|delete">` — colored change badge per file.
- `<phase-timeline>` > `<phase-item name>` — phases with their steps; collapsed after the first when there are more than three. A name already carrying "Phase n —" is not re-numbered.
- `<risk-matrix>` > `<risk-item severity mitigation>` — severity badge; no `severity` renders "unrated".
- `<qa-coverage>` > `<eb-item id [covered|oos]>`, `<qa-item id covers verify>` — groups EBs before criteria. An EB with neither `covered` nor `oos` renders as a red "not covered" warning — a real reviewer finding. `oos` means qa-plan listed it under Out of scope.
- `<pre class="mermaid">` — architecture diagrams. Rendered diagrams become a pan/zoom viewport (drag, scroll, +/−/fit). If mermaid can't load, the raw source stays visible.

## Mermaid — opt-in, plugin-side only

`mermaid.min.js` never leaves the plugin: `render.sh` links it by absolute `file://` path only when `plan.md` contains a ` ```mermaid ` fence. PLAN-FORMAT allows one diagram, under `## Architecture`: a small `flowchart` with explicit, labeled edges.

## Review mode

Each `<review-section>` gets approve/flag controls with a note field; state persists in `localStorage` keyed by the page path. The review bar offers **Copy feedback** (clipboard markdown, works everywhere) and **Save review.json** (File System Access API, Chromium — writes the verdict into the suite dir for the `/blueprint` session to pick up).

`review.json` shape:

```json
{
  "verdict": "approved" | "changes-requested",
  "sections": [{ "id": "phases", "status": "approved" | "flagged", "note": "…" }]
}
```
