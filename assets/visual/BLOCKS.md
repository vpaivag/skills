# BLOCKS — visual.html block catalog

The markup vocabulary `visual-planner` uses inside `template.html`'s `<!-- CONTENT -->` region. All blocks are custom elements styled by `blocks.css` and upgraded by `blocks.js`; they render offline from `file://` with no network access.

General rules:

- Wrap every top-level section in `<review-section>` — review mode attaches approve/flag controls per section.
- Plain markdown-ish HTML (`h2`, `p`, `ul`, `code`) is allowed between blocks for prose that has no block.
- **Architecture and data-flow diagrams are ALWAYS mermaid** (`<pre class="mermaid">` with a `flowchart`). Hand-laid boxes cannot show which node connects to which; a graph without explicit edges communicates nothing. Ordered interactions default to the CSS `<seq-flow>` block; escalate a sequence to mermaid (`sequenceDiagram`) only when it needs nesting or concurrency. When the page contains any mermaid block, insert a script tag pointing at the **plugin's** copy of `mermaid.min.js` by absolute path (see the placeholder in `template.html`); never copy the file into the suite dir. The raw source text is the graceful fallback if the plugin path is unavailable.

## `<review-section>`

Section wrapper. Required around each top-level section.

```html
<review-section id="approach" title="Approach">
  …blocks and prose…
</review-section>
```

- `id` — stable, content-derived (`approach`, `phases`, `files`, `risks`, `qa`, `alternatives`, `contracts`, `ui`). Flags reference it and must survive regeneration.
- `title` — the section heading shown to the reviewer.

## `<plan-filemap>`

The files-changed view.

```html
<plan-filemap>
  <file-entry path="src/api/items.ts" change="modify">Add the X filter to the list endpoint</file-entry>
  <file-entry path="src/api/items.test.ts" change="add">Cover the filter behavior</file-entry>
  <file-entry path="src/legacy/filter.ts" change="delete">Superseded</file-entry>
</plan-filemap>
```

- `change` — `add` | `modify` | `delete`; renders a colored marker per kind (`modify` renders as a yellow "diff" badge).

## `<phase-timeline>`

The plan's phases with their steps.

```html
<phase-timeline>
  <phase-item name="Schema">
    <ol>
      <li>Add the migration for …</li>
    </ol>
  </phase-item>
  <phase-item name="Endpoint">
    <ol><li>…</li></ol>
  </phase-item>
</phase-timeline>
```

Phases render collapsed after the first when there are more than three; the reviewer expands on click. `name` may be the bare phase name (auto-numbered as "Phase n — name") or already carry its own "Phase n — " prefix — both render correctly, never doubled.

## `<contract-diff>`

Before/after for any interface, schema, or API contract the plan states. Renders as stacked full-width rows (before above after) so long contract lines stay comparable — never author it expecting columns.

```html
<contract-diff title="GET /items">
  <contract-before><code>GET /items → 200 [Item]</code></contract-before>
  <contract-after><code>GET /items?x=&lt;value&gt; → 200 [Item where X = value]
GET /items?x=&lt;invalid&gt; → 422</code></contract-after>
</contract-diff>
```

## `<option-compare>`

Design path only — the proposals with their surviving critiques, from `## Alternatives considered` plus the chosen approach.

```html
<option-compare>
  <option-item name="Query-param filter" verdict="chosen">
    <p>Summary…</p>
    <ul class="attacks"><li data-severity="medium">Surviving critique…</li></ul>
  </option-item>
  <option-item name="Materialized view" verdict="rejected">
    <p>Summary…</p>
    <ul class="attacks"><li data-severity="high">The decisive critique…</li></ul>
  </option-item>
</option-compare>
```

## `<risk-matrix>`

```html
<risk-matrix>
  <risk-item severity="high" mitigation="Run backfill behind the flag">Backfill on the hot table locks writes</risk-item>
  <risk-item severity="low" mitigation="Covered by R-1">Default listing regresses</risk-item>
</risk-matrix>
```

- `severity` — `high` | `medium` | `low`.

## `<wire-frame>`

Low-fi UI sketch for UI-facing work. Compose from primitives; keep it schematic — grey boxes, not a mockup.

```html
<wire-frame label="Items list — filtered state">
  <wf-nav label="App header"></wf-nav>
  <wf-row>
    <wf-input label="Filter by X"></wf-input>
    <wf-btn label="Apply"></wf-btn>
  </wf-row>
  <wf-row>
    <wf-col grow>
      <wf-box label="Results table"><wf-text lines="4"></wf-text></wf-box>
    </wf-col>
    <wf-col><wf-box label="Facets"></wf-box></wf-col>
  </wf-row>
</wire-frame>
```

Primitives: `<wf-nav>`, `<wf-row>`, `<wf-col grow?>`, `<wf-box label>`, `<wf-btn label>`, `<wf-input label>`, `<wf-text lines="n">`.

## Architecture diagrams — mermaid, always

Every architecture or data-flow view is a mermaid `flowchart` with explicit, labeled edges. Keep it small and readable: short node labels, `LR` direction unless depth demands `TD`, `subgraph` per service/layer, edge labels for the payload or protocol, and cylinders (`[( )]`) for stores.

Rendered diagrams automatically become a pan/zoom viewport (drag to pan, scroll to zoom, +/−/fit toolbar, fitted on load) — provided by `blocks.js`, nothing to author.

```html
<pre class="mermaid">
flowchart LR
  subgraph orders[orders service]
    T[transitions] --> P[publisher]
  end
  P -->|order events| S[(orders.events)]
  S --> E[email worker]
  S --> I[inventory worker]
  S --> A[analytics worker]
  I -->|restock events| S2[(inventory.events)]
  S2 --> E
</pre>
```

## `<seq-flow>`

Default for ordered interactions. One row per message, in order. Escalate to a mermaid `sequenceDiagram` only for nesting or concurrency.

```html
<seq-flow label="Filtered listing">
  <seq-step from="Browser" to="API">GET /items?x=1</seq-step>
  <seq-step from="API" to="DB">SELECT … WHERE x = 1</seq-step>
  <seq-step from="API" to="DB" reply>rows</seq-step>
  <seq-step from="Browser" to="API" reply>200 — filtered items</seq-step>
</seq-flow>
```

- `reply` attribute renders the row as a response (muted, reversed arrow). Nesting/concurrency beyond ordered rows is the mermaid opt-in case.

## `<qa-coverage>`

Always included, inside the `qa` review-section: the behavioral criteria and the EB coverage map.

```html
<qa-coverage>
  <eb-item id="EB-1" covered>Items can be filtered by X</eb-item>
  <eb-item id="EB-2">Bulk export unchanged</eb-item>  <!-- no `covered` attr = uncovered, rendered as a warning -->
  <qa-item id="B-1" covers="EB-1" verify="GET /items?x=1 returns only X=1">Filtering returns matching items only</qa-item>
  <qa-item id="B-2" covers="EB-1" verify="GET /items?x=bogus → 422">Invalid filter values are rejected</qa-item>
  <qa-item id="R-1" covers="EB-2" verify="GET /items with no params matches pre-change snapshot">Unfiltered listing unchanged</qa-item>
</qa-coverage>
```

Uncovered `eb-item`s render as a visible warning — that's a real reviewer finding, never hide it. The block generates its own group labels ("Expected behaviors" / "Criteria") and orders EBs before criteria regardless of authored order — do **not** add your own headings inside or around it.

## Review mode (provided by the template — do not reimplement)

Each `<review-section>` gets approve/flag controls with a note field; state persists in `localStorage` keyed by suite path. The review bar offers **Copy feedback** (clipboard markdown, works everywhere) and **Save review.json** (File System Access API, Chromium — writes the verdict into the suite dir for the orchestrator to pick up).

`review.json` shape:

```json
{
  "verdict": "approved" | "changes-requested",
  "sections": [{ "id": "approach", "status": "approved" | "flagged", "note": "…" }]
}
```
