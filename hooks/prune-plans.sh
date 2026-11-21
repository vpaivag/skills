#!/bin/sh
# SessionStart hook: delete plan suites older than retainDays.
# Opt-in: does nothing unless .claude/plans-config.json sets "retainDays" to a
# positive integer. Deletes only directories directly under plansDir named
# <YYYY-MM-DD-HHMMSS>-<slug> whose date is older than the cutoff, and never one
# with files tracked in git. Never fails the session: always exits 0.

root=${CLAUDE_PROJECT_DIR:-$(pwd)}
cfg="$root/.claude/plans-config.json"
[ -f "$cfg" ] || exit 0

retain=$(sed -n 's/.*"retainDays"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$cfg" | head -n 1)
case "$retain" in ''|0|0*) exit 0 ;; esac

plans=$(sed -n 's/.*"plansDir"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$cfg" | head -n 1)
[ -n "$plans" ] || plans=".claude/plans"
case "$plans" in /*) dir=$plans ;; *) dir="$root/$plans" ;; esac
dir=${dir%/}

# Never prune Claude Code's own plans dir, the home dir, or the filesystem root.
case "$dir" in ''|/|"$HOME"|"$HOME/.claude"|"$HOME/.claude/plans") exit 0 ;; esac
[ -d "$dir" ] && [ ! -L "$dir" ] || exit 0

# Cutoff date, BSD date first, then GNU.
cutoff=$(date -v-"${retain}"d +%Y-%m-%d 2>/dev/null || date -d "${retain} days ago" +%Y-%m-%d 2>/dev/null)
[ -n "$cutoff" ] || exit 0

in_git=0
git -C "$root" rev-parse --is-inside-work-tree >/dev/null 2>&1 && in_git=1

pruned=""
for suite in "$dir"/*; do
  [ -d "$suite" ] && [ ! -L "$suite" ] || continue
  name=${suite##*/}
  case "$name" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]-*) ;;
    *) continue ;;
  esac
  case "$name" in *[!a-z0-9-]*) continue ;; esac
  date=$(printf '%s' "$name" | cut -c1-10)
  [ "$date" \< "$cutoff" ] || continue
  if [ "$in_git" -eq 1 ] && [ -n "$(git -C "$root" ls-files -- "$suite" 2>/dev/null)" ]; then
    continue
  fi
  rm -rf -- "$suite" && pruned="$pruned $name"
done

if [ -n "$pruned" ]; then
  count=$(echo $pruned | wc -w | tr -d ' ')
  list=$(echo $pruned | sed 's/ /, /g')
  printf '{"systemMessage": "Pruned %s plan suite(s) older than %s days: %s"}\n' "$count" "$retain" "$list"
fi
exit 0
