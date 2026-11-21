// render.js — turns the suite markdown embedded by render.sh into block markup.
// Runs synchronously before blocks.js's DOMContentLoaded upgrades. No network,
// no dependencies. The markdown shapes it understands are the contracts in
// skills/blueprint/PLAN-FORMAT.md, CONTEXT-FORMAT.md, and QA-FORMAT.md; a known
// section that breaks its shape renders raw under a visible warning.
(function () {
  "use strict";

  var warnings = [];

  function source(id) {
    var el = document.getElementById(id);
    if (!el || !el.textContent.trim()) return null;
    return el.textContent
      .replace(/^\n/, "")
      .replace(/<\\\/(script)/gi, "</$1")
      .replace(/<\\!--/g, "<!--");
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function slug(s) {
    return s.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  // ---- inline markdown: code spans, bold, emphasis, links ----

  function inline(s) {
    return String(s).split(/(`[^`]*`)/).map(function (part, i) {
      if (i % 2 === 1) return "<code>" + esc(part.slice(1, -1)) + "</code>";
      return esc(part)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?=[^*\w]|$)/g, "$1<em>$2</em>")
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, text, url) {
          return /^(https?:|\.{0,2}\/|#)/.test(url) ? '<a href="' + url + '">' + text + "</a>" : m;
        });
    }).join("");
  }

  // ---- block markdown: paragraphs, lists, fences, h3+, quotes ----

  var LIST_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
  var FENCE_RE = /^\s*(`{3,}|~{3,})\s*([\w-]*)/;

  function indent(l) { return l.match(/^\s*/)[0].length; }

  function list(lines, start) {
    var ordered = /^\s*\d+\./.test(lines[start]);
    var base = indent(lines[start]);
    var items = [];
    var i = start;
    while (i < lines.length) {
      var l = lines[i];
      var m = LIST_RE.exec(l);
      if (m && m[1].length === base) { items.push([m[3]]); i++; continue; }
      if (l.trim() && items.length && indent(l) > base) { items[items.length - 1].push(l); i++; continue; }
      break;
    }
    var tag = ordered ? "ol" : "ul";
    var html = items.map(function (it) {
      var rest = it.slice(1);
      var nested = -1;
      for (var k = 0; k < rest.length; k++) { if (LIST_RE.test(rest[k])) { nested = k; break; } }
      var text = [it[0]].concat(nested < 0 ? rest : rest.slice(0, nested))
        .map(function (x) { return x.trim(); }).join(" ")
        .replace(/^\[( |x)\]\s+/i, function (m, c) { return c.trim() ? "☑ " : "☐ "; });
      var inner = inline(text);
      if (nested >= 0) inner += list(rest.slice(nested), 0).html;
      return "<li>" + inner + "</li>";
    }).join("");
    return { html: "<" + tag + ">" + html + "</" + tag + ">", next: i };
  }

  function prose(lines) {
    var html = "";
    var para = [];
    var i = 0;
    function flush() {
      if (para.length) { html += "<p>" + inline(para.join(" ")) + "</p>"; para = []; }
    }
    while (i < lines.length) {
      var l = lines[i];
      var f = FENCE_RE.exec(l);
      if (f) {
        flush();
        var code = [];
        i++;
        while (i < lines.length && lines[i].trim().indexOf(f[1]) !== 0) { code.push(lines[i]); i++; }
        i++;
        html += f[2] === "mermaid"
          ? '<pre class="mermaid">' + esc(code.join("\n")) + "</pre>"
          : "<pre><code>" + esc(code.join("\n")) + "</code></pre>";
        continue;
      }
      if (!l.trim()) { flush(); i++; continue; }
      var h = /^#{3,6}\s+(.*)$/.exec(l);
      if (h) { flush(); html += "<h3>" + inline(h[1]) + "</h3>"; i++; continue; }
      if (/^>\s?/.test(l)) {
        flush();
        var quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^>\s?/, "")); i++; }
        html += "<blockquote>" + prose(quote) + "</blockquote>";
        continue;
      }
      if (LIST_RE.test(l)) { flush(); var r = list(lines, i); html += r.html; i = r.next; continue; }
      para.push(l.trim());
      i++;
    }
    flush();
    return html;
  }

  // ---- documents ----

  function parseDoc(text) {
    var fm = {};
    var body = text;
    var m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
    if (m) {
      m[1].split("\n").forEach(function (l) {
        var kv = /^([\w-]+):\s*(.*)$/.exec(l);
        if (kv) fm[kv[1]] = kv[2].trim();
      });
      body = text.slice(m[0].length);
    }
    var doc = { fm: fm, title: null, sections: [] };
    var cur = null;
    var fence = false;
    body.split("\n").forEach(function (l) {
      if (FENCE_RE.test(l)) fence = !fence;
      if (!fence && /^## /.test(l)) { cur = { name: l.slice(3).trim(), lines: [] }; doc.sections.push(cur); return; }
      if (!fence && !cur && /^# /.test(l)) { doc.title = l.slice(2).trim(); return; }
      if (cur) cur.lines.push(l);
    });
    return doc;
  }

  function section(doc, name) {
    for (var i = 0; i < doc.sections.length; i++) {
      if (doc.sections[i].name.toLowerCase() === name) return doc.sections[i];
    }
    return null;
  }

  // Top-level list items with their indented continuation lines.
  function items(lines) {
    var out = [];
    var stray = [];
    lines.forEach(function (l) {
      if (!l.trim()) return;
      if (/^([-*]|\d+\.)\s+/.test(l)) out.push([l.replace(/^([-*]|\d+\.)\s+/, "")]);
      else if (/^\s+/.test(l) && out.length) out[out.length - 1].push(l.trim());
      else stray.push(l.trim());
    });
    return { items: out, stray: stray };
  }

  // Parse every item of a section against one line shape; null when any item breaks it.
  function shaped(sec, re) {
    var r = items(sec.lines);
    var bad = r.stray.slice();
    var parsed = [];
    r.items.forEach(function (it) {
      var m = re.exec(it[0]);
      if (m) parsed.push({ m: m, rest: it.slice(1) });
      else bad.push(it[0]);
    });
    if (bad.length || !parsed.length) {
      warnings.push(sec.name + ": " + (bad.length ? bad.length + " line(s) don't match the format — e.g. “" + bad[0] + "”" : "no items"));
      return null;
    }
    return parsed;
  }

  function warnBox(text) { return '<div class="render-warn">⚠ ' + esc(text) + "</div>"; }

  function fallback(sec) {
    return warnBox("This section doesn't match its PLAN-FORMAT shape — shown raw.") + prose(sec.lines);
  }

  // ---- plan sections → blocks ----

  var builders = {
    "decisions": function (sec) {
      var p = shaped(sec, /^\((chosen|rejected)\)\s+(.+?)\s+—\s+(.+)$/);
      if (!p) return fallback(sec);
      return "<option-compare>" + p.map(function (x) {
        return '<option-item verdict="' + x.m[1] + '" name="' + esc(x.m[2]) + '"><p>' +
          inline([x.m[3]].concat(x.rest).join(" ")) + "</p></option-item>";
      }).join("") + "</option-compare>";
    },
    "files changed": function (sec) {
      var p = shaped(sec, /^`([^`]+)`\s+\((add|modify|delete)\)\s+—\s+(.+)$/);
      if (!p) return fallback(sec);
      return "<plan-filemap>" + p.map(function (x) {
        return '<file-entry path="' + esc(x.m[1]) + '" change="' + x.m[2] + '">' +
          inline([x.m[3]].concat(x.rest).join(" ")) + "</file-entry>";
      }).join("") + "</plan-filemap>";
    },
    "risks & edge cases": function (sec) {
      var p = shaped(sec, /^(?:\((high|medium|low)\)\s+)?(.+?)\s+→\s+(.+)$/);
      if (!p) return fallback(sec);
      if (p.some(function (x) { return !x.m[1]; })) warnings.push(sec.name + ": a risk has no (high|medium|low) severity — rendered unrated");
      return "<risk-matrix>" + p.map(function (x) {
        return "<risk-item" + (x.m[1] ? ' severity="' + x.m[1] + '"' : "") +
          ' mitigation="' + esc([x.m[3]].concat(x.rest).join(" ")) + '">' + inline(x.m[2]) + "</risk-item>";
      }).join("") + "</risk-matrix>";
    },
    "acceptance criteria": function (sec) {
      var p = shaped(sec, /^\[( |x)\]\s+(AC-\d+):\s+(.+)$/i);
      if (!p) return fallback(sec);
      return '<ul class="ac-list">' + p.map(function (x) {
        return '<li><span class="ac-id">' + esc(x.m[2]) + "</span>" + inline([x.m[3]].concat(x.rest).join(" ")) + "</li>";
      }).join("") + "</ul>";
    },
    "phases": function (sec) {
      var phases = [];
      var bad = [];
      sec.lines.forEach(function (l) {
        var h = /^###\s+(.+)$/.exec(l);
        if (h) { phases.push({ name: h[1].trim(), lines: [] }); return; }
        if (phases.length) phases[phases.length - 1].lines.push(l);
        else if (l.trim()) bad.push(l.trim());
      });
      var unnamed = phases.filter(function (ph) { return !/^Phase\s+\d+\s+—\s+\S/.test(ph.name); });
      if (!phases.length || bad.length || unnamed.length) {
        warnings.push(sec.name + ": expected “### Phase n — name” headings, each followed by numbered steps");
        return fallback(sec);
      }
      return "<phase-timeline>" + phases.map(function (ph) {
        return '<phase-item name="' + esc(ph.name) + '">' + prose(ph.lines) + "</phase-item>";
      }).join("") + "</phase-timeline>";
    },
    "context": function (sec) { return prose(sec.lines); },
    "approach": function (sec) { return prose(sec.lines); },
    "architecture": function (sec) {
      if (!sec.lines.some(function (l) { return /^\s*```mermaid/.test(l); })) {
        warnings.push(sec.name + ": no mermaid fence");
      }
      return prose(sec.lines);
    }
  };

  var REQUIRED = ["context", "approach", "files changed", "phases", "risks & edge cases", "acceptance criteria"];

  // ---- QA coverage: context EB-n × qa-plan B-n / R-n ----

  function qaSection(ctx, qa) {
    if (!qa) {
      warnings.push("qa-plan.md was not embedded — QA section missing");
      return warnBox("qa-plan.md was not found when this page was rendered. Re-run render.sh after qa-author finishes.");
    }
    var html = "";
    var intent = section(qa, "intent");
    if (intent) html += prose(intent.lines);

    var criteria = [];
    ["behavioral criteria", "regression guard"].forEach(function (name) {
      var sec = section(qa, name);
      if (!sec) return;
      var p = shaped(sec, /^\[( |x)\]\s+([BR]-\d+)(?:\s+\(covers\s+([^)]+)\))?:\s+(.+)$/i);
      if (!p) { html += "<h3>" + esc(sec.name) + "</h3>" + fallback(sec); return; }
      p.forEach(function (x) {
        var verify = "";
        x.rest.forEach(function (r) { var v = /^-?\s*verify:\s*(.*)$/i.exec(r); if (v) verify = v[1]; });
        criteria.push({ id: x.m[2], covers: (x.m[3] || "").match(/EB-\d+/g) || [], text: x.m[4], verify: verify });
      });
    });

    var oosSec = section(qa, "out of scope");
    var oos = oosSec ? (oosSec.lines.join("\n").match(/EB-\d+/g) || []) : [];
    var covered = {};
    criteria.forEach(function (c) { c.covers.forEach(function (id) { covered[id] = true; }); });

    var ebs = [];
    var ebSec = ctx && section(ctx, "expected behavior");
    if (!ebSec) warnings.push("context.md: no Expected behavior section — coverage map incomplete");
    else {
      var p = shaped(ebSec, /^(EB-\d+):\s+(.+)$/);
      if (p) ebs = p.map(function (x) { return { id: x.m[1], text: [x.m[2]].concat(x.rest).join(" ") }; });
    }

    html += "<qa-coverage>" +
      ebs.map(function (eb) {
        var attr = covered[eb.id] ? " covered" : (oos.indexOf(eb.id) >= 0 ? " oos" : "");
        return '<eb-item id="' + esc(eb.id) + '"' + attr + ">" + inline(eb.text) + "</eb-item>";
      }).join("") +
      criteria.map(function (c) {
        return '<qa-item id="' + esc(c.id) + '"' + (c.covers.length ? ' covers="' + esc(c.covers.join(", ")) + '"' : "") +
          ' verify="' + esc(c.verify) + '">' + inline(c.text) + "</qa-item>";
      }).join("") +
      "</qa-coverage>";

    if (oosSec) html += "<h3>Out of scope</h3>" + prose(oosSec.lines);
    return html;
  }

  // ---- page ----

  function render() {
    var root = document.getElementById("plan-root");
    if (!root) return;
    var planText = source("md-plan");
    if (!planText) {
      root.innerHTML = "<h1>Plan</h1>" + warnBox("plan.md was not embedded. Re-run render.sh <suite-dir>.");
      return;
    }
    var plan = parseDoc(planText);
    var ctxText = source("md-context");
    var qaText = source("md-qa");
    var ctx = ctxText ? parseDoc(ctxText) : null;
    var qa = qaText ? parseDoc(qaText) : null;
    if (!ctx) warnings.push("context.md was not embedded");

    var title = (plan.fm.title || (plan.title || "").replace(/^Plan:\s*/, "") || "Untitled").trim();
    document.title = "Plan: " + title;

    REQUIRED.forEach(function (name) {
      if (!section(plan, name)) warnings.push("plan.md is missing the required “## " + name.replace(/(^|\s)\w/g, function (c) { return c.toUpperCase(); }) + "” section");
    });

    var body = plan.sections.map(function (sec) {
      var key = sec.name.toLowerCase();
      var build = builders[key];
      var inner;
      if (build) inner = build(sec);
      else {
        warnings.push("“## " + sec.name + "” is not a PLAN-FORMAT section");
        inner = prose(sec.lines);
      }
      return '<review-section id="' + esc(slug(sec.name)) + '" title="' + esc(sec.name) + '">' + inner + "</review-section>";
    }).join("");

    body += '<review-section id="qa" title="QA — authored blind">' + qaSection(ctx, qa) + "</review-section>";

    var meta = [];
    if (plan.fm.created) meta.push(plan.fm.created);
    if (ctx && ctx.fm.source && ctx.fm.source !== "prompt") meta.push("source: " + ctx.fm.source);

    var banner = warnings.length
      ? '<div class="render-warn render-warn-top"><strong>⚠ ' + warnings.length + " format issue(s)</strong><ul>" +
        warnings.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul></div>"
      : "";

    root.innerHTML = "<h1>Plan: " + esc(title) + "</h1>" +
      (meta.length ? '<p class="subtitle">' + esc(meta.join(" · ")) + "</p>" : "") +
      banner + body;
  }

  render();
})();
