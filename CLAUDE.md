# skills

Claude Code plugin marketplace + skills bundle. Plugin name: `skills`. Marketplace name: `vpaivag`.

Each skill is a self-contained `SKILL.md` under `skills/<name>/`, loaded on demand by the harness when its trigger fires. The plugin also ships declared agents (`agents/*.md`, auto-discovered) and the static asset library for `visual.html` (`assets/visual/`).

## Hard rules

- **SKILL.md frontmatter is load-bearing.** Every `skills/<name>/SKILL.md` must start with YAML frontmatter containing `name` and `description`. The `description` is the trigger string the harness matches against user intent — edit it deliberately, not stylistically.
- **Adding/removing/renaming a skill touches three places.** Keep them in sync:
  1. `skills/<name>/SKILL.md` (the skill itself)
  2. The `skills` array in `.claude-plugin/plugin.json`
  3. The per-skill section + table of contents in `README.md`

  Agents are the analogous rule with two places: `agents/<name>.md` (auto-discovered, no manifest entry) and the Agents table in `README.md`.
- **Version lives in `plugin.json` only.** Bump `version` in `.claude-plugin/plugin.json` for each release. Do **not** add a `version` field to `.claude-plugin/marketplace.json` — omitting it lets every git commit count as a new version, which is what enables `/plugin update` to detect changes without a manual marketplace bump. (See https://code.claude.com/docs/en/plugin-marketplaces.)
- **Companion files live beside SKILL.md.** Some skills reference siblings (e.g. `skills/plan/CONTEXT-FORMAT.md`, `skills/plan/PLAN-FORMAT.md`, `skills/plan/QA-FORMAT.md`). Don't move or rename them without updating the references inside `SKILL.md` and `agents/*.md`.
- **`*-FORMAT.md` files are contracts, enforced just-in-time.** Skills and agents must instruct reading the format file immediately before writing its artifact ("now — not earlier, never from memory") and validating the written file against the format's Required list. Artifact formats use real YAML frontmatter and stable IDs (`EB-n`, `AC-n`, `B-n`) — never the retired `> **Field:**` blockquote style.
- **Preserve the user's voice in skill prose.** Don't rewrite phrasing into a different style — the wording in each `SKILL.md` is intentional.
- **Static assets and vanilla client-side JS only.** `assets/visual/` may hold CSS, dependency-free browser JS, HTML templates, and the vendored `mermaid.min.js` (plugin-side only — never copied into suite dirs; opt-in per the rule in `assets/visual/BLOCKS.md`). No build step, no package managers, no runtime dependencies, no servers, no CI scaffolding.
- **Split context is the pipeline's design principle.** `qa-author` sees only `context.md`; `plan-critic` sees one proposal; `/execute-qa` never reads `plan.md`. Don't "improve" a skill or agent by giving a blind role more context — the blindness is the feature.

## Layout

```
.claude-plugin/
  plugin.json        # plugin manifest, lists skills + version
  marketplace.json   # marketplace manifest; no version field (see hard rules)
agents/
  plan-critic.md     # red/blue proposal critic (opus)
  qa-author.md       # blind QA-plan author (inherit)
  visual-planner.md  # suite → visual.html renderer (sonnet)
assets/
  visual/            # template.html, blocks.css, blocks.js, BLOCKS.md, mermaid.min.js
skills/
  <name>/SKILL.md    # one skill per directory; companions allowed alongside
README.md            # per-skill sections + Agents table; update when either changes
```
