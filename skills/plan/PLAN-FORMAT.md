# Plan format

The shape of `plan.md` — the single executable plan `/plan` writes into the suite directory. There is exactly one plan file per suite; there are no chunks, no index, and no status machinery. `/execute-plan` consumes this file as its contract.

## Schema

```markdown
---
artifact: plan
title: <task title>
path: design | mechanical
context: ./context.md
created: <YYYY-MM-DD>
---

# Plan: <task title>

## Context

<Restated problem with every assumption resolved. Self-contained: the executor reads this file with no prior conversation context.>

## Approach

<Chosen approach in 2–4 sentences.>

## Alternatives considered

<Design path only — omit the section on the mechanical path. One entry per rejected proposal: its name, a 1–2 sentence summary, and the decisive critique that killed it **with the critic's severity** (high/medium/low). This is the only place losing proposals survive; the raw proposal and critique intermediates are not persisted.>

## Files changed

- `<path>` — <one-line intent>

## Phases

### Phase 1 — <name>

1. <Step detailed enough that an executor with no prior context can do it. Follow the code-in-plans rule strictly.>
2. <step>

### Phase 2 — <name>

1. <step>

## Risks & edge cases

- (high) <risk>: <mitigation>
- (low) <risk>: <mitigation>

## Acceptance criteria

- [ ] AC-1: <objective, mechanically verifiable criterion>
- [ ] AC-2: <criterion>
```

## Rules

- **Required:** the YAML frontmatter with all five keys, and every section above except `## Alternatives considered` (design path only).
- **Pure text.** No mermaid, no diagrams, no HTML. The executor is the primary reader and diagrams cost it context; every visual lives in `visual.html`, which is a projection of this file, never a source.
- **Phases, not chunks.** A phase is an ordered group of steps with a natural checkpoint after it (builds, tests pass, a layer is complete). Small plans have one phase. The executor runs all phases in one session, reporting at each boundary — phases are pacing, not separate execution units.
- **`AC-n` IDs are stable and sequential.** The executor's report references them by ID. Never renumber existing items when revising — append.
- **Severities are stated, never inferred downstream.** Every risk carries a leading `(high|medium|low)`, and every rejected alternative carries its critique's severity. The visual renderer is forbidden from inventing these; a plan without them forces an "unrated" render and a reported gap.
- **Mechanical criteria only.** `## Acceptance criteria` covers what the executor can verify from the inside: compiles, migration runs, flag exists, tests pass. Behavioral intent — does the feature do what the user asked — belongs to `qa-plan.md` and is deliberately kept out of this file.

## Code in plans — strict rule

Plans are interface contracts and intent. The executor designs implementation.

### Include

- **Reference snippets** from existing code (≤10 lines) showing patterns the executor should follow
- **Interface specifications**: function signatures, type definitions, schema fields, API contracts
- **Pseudocode** for non-obvious algorithmic decisions (≤5 lines, only when prose would be ambiguous)

### Do NOT include

- Implementation bodies (function internals, error message strings, validation logic, control flow)
- Constants or magic numbers — name the concept, let the executor pick the value
- Anything the executor would write themselves given the interface spec

### Negative example (do not do this)

```ruby
def validate_segment!(name, value)
  raise ArgumentError, "#{name} must be a String" unless value.is_a?(String)
  raise ArgumentError, "#{name} can't be blank" if value.strip.empty?
  INVALID_CHARS.each do |c|
    raise ArgumentError, "#{name} cannot contain '#{c}'" if value.include?(c)
  end
  raise ArgumentError, "#{name} contains control chars" if value =~ /[[:cntrl:]]/
end
```

### Positive example (do this instead)

> Add `Topics.validate_segment!(name, value)`: raises `ArgumentError` if value is not a String, is blank, contains MQTT wildcards (`+`, `#`, `/`), or contains control characters. Used by `installation_sync` to validate inputs.

If you find yourself writing more than ~5 lines of new implementation code, stop and convert to prose specification.
