---
name: propose
description: Create a new OpenSpec change proposal following project conventions. Use when planning any code change.
disable-model-invocation: true
---

Create a new OpenSpec change proposal. Use `$ARGUMENTS` as the proposal topic if provided.

## Steps

1. **Determine proposal number**: Read `openspec/changes/` to find the next sequential number (e.g., if 010 exists, next is 011).

2. **Write the proposal** at `openspec/changes/<number>-<slug>.md` with this structure:

```markdown
---
id: P<number>
title: <title>
status: draft
date: <today's date ISO 8601>
specs_affected: [<list affected spec directories>]
risk: low | medium | high
---

## Why

<Business/design justification — why this change matters>

## What

<Detailed description of changes>

### Affected Files

- `path/to/file.js` — what changes

### Verification

- <How to verify this works — visual or functional criteria>
```

3. **Reference the design spec** (`docs/superpowers/specs/2026-04-01-dungeon-lord-startup-design.md`) for any visual or mechanic decisions.

4. Present the draft for review before committing.
