# Plan format

Every chunk plan file (whether the only chunk in a single-plan suite, or one of many in a multi-chunk suite) uses this structure.

## Required structure

```markdown
# Plan: <Chunk Title>

> **Status:** pending
> **Depends on:** (none) | <chunk-name>, <chunk-name>
> **Part of suite:** `<timestamp>-<feature-slug>/index.md`

## Context
<Restated problem with assumptions resolved. State what this chunk depends on from sibling chunks — describe the *outputs in the codebase* a dependency leaves behind, not its plan content. The executor for this chunk should not need to read another chunk's plan.>

## Approach
<Chosen approach in 2–4 sentences. Brief mention of what was rejected and why.>

## Files Changed
- `<path>`: <one-line intent>

## Implementation Steps
1. <Step detailed enough that an executor with no prior context can do it. Follow the code-in-plans rule strictly.>

## Risks & Edge Cases
- <risk>: <mitigation>

## Acceptance Criteria
- [ ] <objective, verifiable criterion>
```

The frontmatter block (`> **Status:** ...`) is required even for single-chunk suites. The status line is what `execute-plan` and `plan-tracker` use to find and validate the chunk.

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