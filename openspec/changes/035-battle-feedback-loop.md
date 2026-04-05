---
id: "035"
title: "Battle Feedback Loop — Monster HP, Post-Battle Stats, Combat Dynamics"
status: applying
date: "2026-04-05"
specs_affected:
  - battle
  - dungeon_map
depends_on: ["034"]
risk: low
---

# Proposal 035: Battle Feedback Loop

## Why

Gemini video analysis + Dungeon Maker comparison revealed critical gameplay gaps:
1. Players can't see monster HP during battle (DM shows HP bars under every monster)
2. No post-battle stats — players don't know if their layout worked
3. Combat visual feedback was one-directional (fixed in P034)

These gaps break the core loop: place monsters → battle → learn → improve layout.

## What

### Part A: Monster HP Bars (DONE)
- Show green HP bar (40x4px) below each monster cell during battle
- Color-coded: green >50%, yellow >25%, red <25%
- Hide when monster dies

### Part B: Per-Cell Battle Statistics (IN PROGRESS)
- BattleManager tracks per cell: total damage dealt, kills, trap damage, trap triggers
- On battleEnd, emit cellStats in the event
- BattleUI shows stats overlay on map after battle ends (before banner dismissal)
- Each cell shows: damage dealt + kill count as small text

### Part C: Enhanced Combat Dynamics (DONE in P034)
- Trap trigger visual effects (5 types)
- Bidirectional combat feedback (monster flash + cell shake)
- Hero death animation enhancement

## Changes

### `src/models/BattleManager.js`
- Add `_cellStats` Map tracking damage/kills/trapDamage/trapTriggers per cell
- Add `_addCellStat()` helper
- Track in monster attack, monster skill, trap trigger, hero defeated
- Emit cellStats in battleEnd event

### `src/substates/BattleUI.js`
- Add `_createMonsterHpBars()` / `_updateMonsterHpBars()` for battle-time HP display
- Add `_showCellStatsOverlay()` to display per-cell stats after battle ends
- Trap visual effects (`_spawnTrapEffect`)
- Combat dynamics (`_flashMonsterSprite`, `_shakeCombatCell`)
- Enhanced hero death animation

## Affected Files

| File | Change |
|------|--------|
| `src/models/BattleManager.js` | cellStats tracking + emit |
| `src/substates/BattleUI.js` | Monster HP bars, stats overlay, combat VFX |

## Risk

Low. All changes are visual/tracking layers on top of existing battle logic. No game state or balance changes.

## Verification

1. `npm run build` passes
2. Battle: monster cells show HP bars that update in real-time
3. Monster HP bar turns yellow then red as monster takes damage
4. Monster HP bar disappears when monster dies
5. Battle end: each cell shows damage dealt and kill count
6. Stats overlay auto-dismisses or dismisses with battle banner
