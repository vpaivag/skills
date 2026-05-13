# skills

Claude Code plugin marketplace + skills bundle. Plugin name: `skills`. Marketplace name: `vpaivag`.

Each skill is a self-contained `SKILL.md` under `skills/<name>/`, loaded on demand by the harness when its trigger fires.

## Hard rules

- **SKILL.md frontmatter is load-bearing.** Every `skills/<name>/SKILL.md` must start with YAML frontmatter containing `name` and `description`. The `description` is the trigger string the harness matches against user intent — edit it deliberately, not stylistically.
- **Adding/removing/renaming a skill touches three places.** Keep them in sync:
  1. `skills/<name>/SKILL.md` (the skill itself)
  2. The `skills` array in `.claude-plugin/plugin.json`
  3. The per-skill section + table of contents in `README.md`
- **Version lives in `plugin.json` only.** Bump `version` in `.claude-plugin/plugin.json` for each release. Do **not** add a `version` field to `.claude-plugin/marketplace.json` — omitting it lets every git commit count as a new version, which is what enables `/plugin update` to detect changes without a manual marketplace bump. (See https://code.claude.com/docs/en/plugin-marketplaces.)
- **Companion files live beside SKILL.md.** Some skills reference siblings (e.g. `skills/deep-plan/INDEX-FORMAT.md`, `skills/deep-plan/PLAN-FORMAT.md`). Don't move or rename them without updating the references inside `SKILL.md`.
- **Preserve the user's voice in skill prose.** Don't rewrite phrasing into a different style — the wording in each `SKILL.md` is intentional.
- **No code, no build, no tests.** This repo is pure markdown + JSON manifests. Don't add tooling, package managers, or CI scaffolding unless asked.

## Layout

```
.claude-plugin/
  plugin.json        # plugin manifest, lists skills + version
  marketplace.json   # marketplace manifest, version must match plugin.json
skills/
  <name>/SKILL.md    # one skill per directory; companions allowed alongside
README.md            # per-skill sections; update when skills change
```
