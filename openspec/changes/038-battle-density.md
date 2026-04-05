---
id: "038"
title: "Battle Density — More Heroes + Faster Spawn"
status: proposed
date: "2026-04-05"
specs_affected:
  - battle
depends_on: ["037"]
risk: low
---

# Proposal 038: Battle Density — More Heroes + Faster Spawn

## Why

Gemini comparison with Dungeon Maker identified that DM battles feel "simultaneous and fluid" because many units fight at once across multiple cells. Our battles have 1-4 heroes arriving one-by-one, making combat feel sequential.

## What

- Increase hero count ranges to create more simultaneous combat:
  - normalBattle: [1,3] → [2,4]
  - eliteBattle: [2,4] → [3,5]
- Reduce hero spawn delay to get heroes onto the map faster
- Result: more heroes fighting in parallel across multiple cells = higher visual density

## Changes

### `src/models/BattleManager.js` — Hero count + spawn timing (~5 lines)
- Update `countRange` in `_generateHeroes`
- Reduce spawn wait time if applicable

## Affected Files

| File | Change |
|------|--------|
| `src/models/BattleManager.js` | Hero count ranges |

## Risk

Low. More heroes = slightly harder battles, but this is a visual density improvement. Balance can be tuned later.

## Verification

1. `npm run build` passes
2. Normal battle spawns 2-4 heroes (was 1-3)
3. Elite battle spawns 3-5 heroes (was 2-4)
4. Multiple cells have combat simultaneously
