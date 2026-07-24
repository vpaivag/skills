// blocks.js — block upgrades + review mode for visual.html.
// Authored once in the plugin; copied into each suite dir by visual-planner.
// No network access, no dependencies; mermaid.min.js is optional and loaded by the template.
(function () {
  "use strict";

  var storeKey = "plan-review:" + location.pathname;

  function loadState() {
    try { return JSON.parse(localStorage.getItem(storeKey)) || { sections: {} }; }
    catch (e) { return { sections: {} }; }
  }
  function saveState(state) {
    localStorage.setItem(storeKey, JSON.stringify(state));
  }

  var state = loadState();

  // ---- structural upgrades ----

  function upgradeSections() {
    document.querySelectorAll("review-section").forEach(function (sec) {
      var id = sec.getAttribute("id") || "section";
      var head = document.createElement("div");
      head.className = "rs-head";
      var h2 = document.createElement("h2");
      h2.textContent = sec.getAttribute("title") || id;
      var controls = document.createElement("div");
      controls.className = "rs-controls";
      var approve = document.createElement("button");
      approve.className = "rs-approve";
      approve.textContent = "Approve";
      var flag = document.createElement("button");
      flag.className = "rs-flag";
      flag.textContent = "Flag";
      controls.append(approve, flag);
      head.append(h2, controls);
      sec.prepend(head);

      var note = document.createElement("textarea");
      note.className = "rs-note";
      note.placeholder = "What's wrong or missing in this section?";
      note.rows = 2;
      sec.append(note);

      var saved = state.sections[id];
      if (saved) {
        if (saved.status) sec.setAttribute("data-review", saved.status);
        if (saved.note) note.value = saved.note;
      }

      function set(status) {
        var current = sec.getAttribute("data-review");
        if (current === status) {
          sec.removeAttribute("data-review");
          delete state.sections[id];
        } else {
          sec.setAttribute("data-review", status);
          state.sections[id] = { status: status, note: note.value };
        }
        saveState(state);
        renderStatus();
      }
      approve.addEventListener("click", function () { set("approved"); });
      flag.addEventListener("click", function () { set("flagged"); });
      note.addEventListener("input", function () {
        if (state.sections[id]) { state.sections[id].note = note.value; saveState(state); }
      });
    });
  }

  function upgradePhases() {
    var phases = document.querySelectorAll("phase-item");
    phases.forEach(function (ph, i) {
      var name = document.createElement("div");
      name.className = "ph-name";
      // tolerate names that already carry their own "Phase n —" prefix
      var raw = ph.getAttribute("name") || "";
      var label = /^\s*phase\b/i.test(raw) ? raw : "Phase " + (i + 1) + " — " + raw;
      name.innerHTML = label + ' <span class="ph-caret"></span>';
      ph.prepend(name);
      if (phases.length > 3 && i > 0) ph.setAttribute("data-collapsed", "");
      function caret() {
        name.querySelector(".ph-caret").textContent = ph.hasAttribute("data-collapsed") ? "▸ expand" : "";
      }
      caret();
      name.addEventListener("click", function () {
        ph.toggleAttribute("data-collapsed");
        caret();
      });
    });
  }

  function upgradeMisc() {
    document.querySelectorAll("contract-diff").forEach(function (cd) {
      var t = document.createElement("div");
      t.className = "cd-title";
      t.textContent = cd.getAttribute("title") || "";
      var grid = document.createElement("div");
      grid.className = "cd-grid";
      while (cd.firstChild) grid.appendChild(cd.firstChild);
      cd.append(t, grid);
    });
    document.querySelectorAll("option-item").forEach(function (oi) {
      var n = document.createElement("div");
      n.className = "oi-name";
      n.textContent = oi.getAttribute("name") || "";
      oi.prepend(n);
    });
    document.querySelectorAll("file-entry").forEach(function (fe) {
      var wrap = document.createElement("div");
      var path = document.createElement("div");
      path.className = "fe-path";
      path.textContent = fe.getAttribute("path") || "";
      var intent = document.createElement("div");
      intent.className = "fe-intent";
      while (fe.firstChild) intent.appendChild(fe.firstChild);
      wrap.append(path, intent);
      fe.append(wrap);
    });
    document.querySelectorAll("qa-coverage").forEach(function (qc) {
      // group into "Expected behaviors" then "Criteria", whatever order they were authored in
      var ebs = Array.prototype.slice.call(qc.querySelectorAll("eb-item"));
      var qas = Array.prototype.slice.call(qc.querySelectorAll("qa-item"));
      function group(label, items) {
        if (!items.length) return;
        var g = document.createElement("div");
        g.className = "qc-group";
        g.textContent = label;
        qc.append(g);
        items.forEach(function (el) { qc.append(el); });
      }
      group("Expected behaviors", ebs);
      group("Criteria", qas);
    });
    document.querySelectorAll("wf-text").forEach(function (wt) {
      var n = parseInt(wt.getAttribute("lines") || "3", 10);
      for (var i = 0; i < n; i++) wt.appendChild(document.createElement("i"));
    });
  }

  // ---- review bar ----

  function collectReview() {
    var sections = [];
    document.querySelectorAll("review-section").forEach(function (sec) {
      var id = sec.getAttribute("id");
      var saved = state.sections[id];
      if (saved && saved.status) {
        sections.push({ id: id, status: saved.status, note: saved.note || "" });
      }
    });
    var flagged = sections.some(function (s) { return s.status === "flagged"; });
    return { verdict: flagged ? "changes-requested" : "approved", sections: sections };
  }

  function feedbackMarkdown(review) {
    var lines = ["## Plan review — " + review.verdict, ""];
    review.sections.forEach(function (s) {
      lines.push("- **" + s.id + "**: " + s.status + (s.note ? " — " + s.note : ""));
    });
    if (!review.sections.length) lines.push("(no per-section marks)");
    return lines.join("\n");
  }

  var statusEl, saveBtn;

  function renderStatus() {
    if (!statusEl) return;
    var review = collectReview();
    var total = document.querySelectorAll("review-section").length;
    var approved = review.sections.filter(function (s) { return s.status === "approved"; }).length;
    var flagged = review.sections.filter(function (s) { return s.status === "flagged"; }).length;
    statusEl.textContent = approved + "/" + total + " approved" + (flagged ? " · " + flagged + " flagged" : "");
  }

  var dirHandle = null;

  async function saveReviewJson() {
    var review = collectReview();
    try {
      if (!dirHandle) dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      var fh = await dirHandle.getFileHandle("review.json", { create: true });
      var w = await fh.createWritable();
      await w.write(JSON.stringify(review, null, 2));
      await w.close();
      saveBtn.textContent = "Saved review.json ✓";
      setTimeout(function () { saveBtn.textContent = "Save review.json"; }, 2500);
    } catch (e) {
      if (e && e.name === "AbortError") return;
      alert("Couldn't write review.json (" + e + "). Use Copy feedback instead.");
    }
  }

  function buildBar() {
    var bar = document.createElement("div");
    bar.id = "review-bar";
    statusEl = document.createElement("span");
    statusEl.className = "rb-status";

    var copy = document.createElement("button");
    copy.textContent = "Copy feedback";
    copy.addEventListener("click", function () {
      navigator.clipboard.writeText(feedbackMarkdown(collectReview())).then(function () {
        copy.textContent = "Copied ✓";
        setTimeout(function () { copy.textContent = "Copy feedback"; }, 2500);
      });
    });

    bar.append(statusEl, copy);

    if (window.showDirectoryPicker && location.protocol === "file:") {
      saveBtn = document.createElement("button");
      saveBtn.className = "primary";
      saveBtn.textContent = "Save review.json";
      saveBtn.title = "Pick the suite directory once; writes the verdict for the /plan session to read";
      saveBtn.addEventListener("click", saveReviewJson);
      bar.append(saveBtn);
    }

    document.body.append(bar);
    renderStatus();
  }

  // ---- mermaid (optional) + pan/zoom viewport ----

  function addPanZoom(pre) {
    var svg = pre.querySelector("svg");
    if (!svg) return;
    var nat = svg.getBoundingClientRect();
    var natW = nat.width || 1, natH = nat.height || 1;
    pre.classList.add("mz-viewport");

    var s = 1, tx = 0, ty = 0;
    function apply() { svg.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + s + ")"; }
    function fit() {
      var vw = pre.clientWidth, vh = pre.clientHeight;
      s = Math.min(vw / natW, vh / natH, 1.5) * 0.92;
      tx = (vw - natW * s) / 2;
      ty = (vh - natH * s) / 2;
      apply();
    }
    function zoomAt(factor, cx, cy) {
      var s2 = Math.min(6, Math.max(0.2, s * factor));
      tx = cx - (cx - tx) * (s2 / s);
      ty = cy - (cy - ty) * (s2 / s);
      s = s2;
      apply();
    }

    var tools = document.createElement("div");
    tools.className = "mz-tools";
    [["+", function () { zoomAt(1.3, pre.clientWidth / 2, pre.clientHeight / 2); }],
     ["−", function () { zoomAt(0.77, pre.clientWidth / 2, pre.clientHeight / 2); }],
     ["⌂", fit]].forEach(function (def) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = def[0];
      b.title = def[0] === "⌂" ? "Fit" : def[0] === "+" ? "Zoom in" : "Zoom out";
      b.addEventListener("click", def[1]);
      tools.append(b);
    });
    pre.append(tools);

    var hint = document.createElement("span");
    hint.className = "mz-hint";
    hint.textContent = "drag to pan · scroll to zoom";
    pre.append(hint);

    var dragging = false, lx = 0, ly = 0;
    pre.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".mz-tools")) return;
      dragging = true; lx = e.clientX; ly = e.clientY;
      pre.setPointerCapture(e.pointerId);
    });
    pre.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      tx += e.clientX - lx; ty += e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      apply();
    });
    pre.addEventListener("pointerup", function () { dragging = false; });
    pre.addEventListener("pointercancel", function () { dragging = false; });
    pre.addEventListener("wheel", function (e) {
      e.preventDefault();
      var r = pre.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 0.87, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    pre.addEventListener("dblclick", function (e) {
      var r = pre.getBoundingClientRect();
      zoomAt(1.6, e.clientX - r.left, e.clientY - r.top);
    });

    fit();
  }

  function initMermaid() {
    if (!window.mermaid) return; // graceful fallback: raw source stays visible
    // derive the mermaid theme from the live CSS tokens so diagrams match the
    // block palette in both light and dark without a second color definition
    var css = getComputedStyle(document.documentElement);
    function v(name) { return css.getPropertyValue(name).trim(); }
    window.mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        background: v("--surface"),
        fontFamily: '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace',
        fontSize: "13px",
        primaryColor: v("--accent-soft"),
        primaryTextColor: v("--ink"),
        primaryBorderColor: v("--accent"),
        secondaryColor: v("--surface-2"),
        tertiaryColor: v("--bg"),
        lineColor: v("--muted"),
        textColor: v("--ink"),
        nodeBorder: v("--accent"),
        mainBkg: v("--accent-soft"),
        clusterBkg: v("--surface-2"),
        clusterBorder: v("--line"),
        titleColor: v("--ink"),
        edgeLabelBackground: v("--surface-2"),
        actorBkg: v("--accent-soft"),
        actorBorder: v("--accent"),
        actorTextColor: v("--ink"),
        signalColor: v("--ink"),
        signalTextColor: v("--ink"),
        noteBkgColor: v("--warn-soft"),
        noteBorderColor: v("--warn"),
        noteTextColor: v("--ink")
      },
      flowchart: { useMaxWidth: false },
      sequence: { useMaxWidth: false }
    });
    window.mermaid.run({ querySelector: "pre.mermaid" }).then(function () {
      document.querySelectorAll("pre.mermaid").forEach(addPanZoom);
    }).catch(function () { /* leave raw source visible */ });
  }

  document.addEventListener("DOMContentLoaded", function () {
    upgradeSections();
    upgradePhases();
    upgradeMisc();
    buildBar();
    initMermaid();
  });
})();
