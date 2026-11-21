#!/bin/sh
# render.sh <suite-dir> — build <suite-dir>/visual.html from the suite's markdown.
# No agent, no dependencies: embeds context.md, plan.md and qa-plan.md into
# template.html and copies the runtime assets beside it. render.js parses the
# embedded markdown in the browser; blocks.js upgrades the blocks it emits.
set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: render.sh <suite-dir>" >&2
  exit 2
fi

suite=${1%/}
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if [ ! -f "$suite/plan.md" ]; then
  echo "render.sh: $suite/plan.md not found" >&2
  exit 1
fi

cp -f "$here/blocks.css" "$here/blocks.js" "$here/render.js" "$suite/"

# Inline one markdown file as a script data block. "</script" and "<!--" would
# end or confuse the block, so they are escaped here and restored by render.js.
embed() {
  printf '<script type="text/markdown" id="%s">\n' "$1"
  if [ -f "$2" ]; then
    sed -e 's#</\([sS][cC][rR][iI][pP][tT]\)#<\\/\1#g' -e 's#<!--#<\\!--#g' "$2"
  fi
  printf '</script>\n'
}

# mermaid stays in the plugin; linked by absolute path only when the plan has a diagram.
mermaid_tag=""
if grep -q '^```mermaid' "$suite/plan.md"; then
  mermaid_url="file://$(printf '%s' "$here/mermaid.min.js" | sed 's/ /%20/g')"
  mermaid_tag="<script src=\"$mermaid_url\"></script>"
fi

out="$suite/visual.html"
tmp="$out.tmp.$$"
trap 'rm -f "$tmp"' EXIT

while IFS= read -r line || [ -n "$line" ]; do
  case $line in
    *'<!-- EMBED -->'*)
      embed md-context "$suite/context.md"
      embed md-plan "$suite/plan.md"
      embed md-qa "$suite/qa-plan.md"
      ;;
    *'<!-- MERMAID -->'*)
      if [ -n "$mermaid_tag" ]; then printf '%s\n' "$mermaid_tag"; fi
      ;;
    *)
      printf '%s\n' "$line"
      ;;
  esac
done < "$here/template.html" > "$tmp"

mv -f "$tmp" "$out"
trap - EXIT

missing=""
[ -f "$suite/context.md" ] || missing="$missing context.md"
[ -f "$suite/qa-plan.md" ] || missing="$missing qa-plan.md"
if [ -n "$missing" ]; then
  echo "render.sh: wrote $out (missing:$missing — the page shows a warning)"
else
  echo "render.sh: wrote $out"
fi
