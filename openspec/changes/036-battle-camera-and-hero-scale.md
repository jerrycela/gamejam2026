---
id: "036"
title: "Battle Camera Tracking + Hero Scale Up"
status: proposed
date: "2026-04-05"
specs_affected:
  - battle
  - dungeon_map
depends_on: ["035"]
risk: medium
revision: 2
review_history:
  - round: 1
    codex: "NO — 2 P1 (camera only pans on combatStart not heroMove; reset to default not pre-battle position), 2 P2 (X-axis pan missing; HERO_RADIUS may affect logic)"
    gemini: "YES — 0 P1, 2 P2"
    exit: "R2 fixes all P1+P2: pan on combatStart+heroArrive+heroMove, store/restore pre-battle scroll, scrollToCell handles both X+Y, HERO_RADIUS is visual-only (confirmed no collision logic uses it)"
---

# Proposal 036: Battle Camera Tracking + Hero Scale Up

## Why

Gemini's frame-by-frame analysis of Dungeon Maker revealed two critical differences:
1. **DM camera smoothly follows the battle** — pans to whichever cell has active combat. Our camera is static, so battles happening off-screen are invisible.
2. **DM heroes are 30-45px** — ours are 24px, too small to see on mobile. DM's larger heroes make combat readable even when overlapping.

These two changes together would make battles dramatically more visible and engaging.

## What

### Part A: Battle Camera Tracking
- When combat starts in a cell (`combatStart`), smoothly pan the map so that cell is centered on screen
- When hero arrives at a new cell (`heroArrive`), pan to that cell
- When hero starts moving (`heroMove`), pan toward the destination cell
- Pan duration: 300ms, ease Sine.InOut
- Store pre-battle scroll position in `start()`, restore it in `_onBattleEnd`
- `scrollToCell` handles both X and Y axes (map is vertical-scrolling but cells have X variation in branching layouts)

### Part B: Hero Sprite Scale Up
- Increase hero sprite from 24px to 36px (50% larger)
- Increase hero HP bar from 30x4 to 36x4
- Adjust hero radius constant from 12 to 18
- Walk sprite scales up proportionally

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Camera pan target | combatStart + heroArrive + heroMove events | Follows the action across cells |
| Camera restore | Store pre-battle scrollY, restore on battleEnd | Don't jump to hardcoded default |
| Pan duration | 300ms | Fast enough to not feel sluggish, slow enough to be visible |
| Hero size | 36px (up from 24px) | Matches DM's ~40px heroes proportionally (DM has bigger screens) |
| HP bar width | 36px (up from 30px) | Proportional to new hero size |

## Changes

### 1. `src/substates/BattleUI.js` — Camera pan on combat (~20 lines)
- In `start()`: store `_preBattleScrollY = dungeonMapUI.getScrollY()`
- In `_onCombatStart`: call `scrollToCell(cellId, 300)`
- In `_onHeroArrive`: call `scrollToCell(toCellId, 300)`
- In `_onHeroMove`: call `scrollToCell(toCellId, 500)` (slower, anticipatory)
- In `_onBattleEnd`: restore `_preBattleScrollY` with tween

### 2. `src/substates/DungeonMapUI.js` — `scrollToCell()` + `getScrollY()` methods (~15 lines)
- `scrollToCell(cellId, duration)`: calculate target scrollY to center cell on screen, tween `_scrollY`
- `getScrollY()`: return current `_scrollY`
- `setScrollY(value, duration)`: tween or set `_scrollY`
- Note: map is primarily vertical-scroll. X variation is within screen width for all cell positions.

### 3. `src/substates/BattleUI.js` — Hero size constants (~3 lines)
- `HERO_RADIUS`: 12 → 18
- Hero sprite display size: 24 → 36
- `HP_BAR_W`: 30 → 36

## Affected Files

| File | Change |
|------|--------|
| `src/substates/BattleUI.js` | Camera pan calls, hero size constants |
| `src/substates/DungeonMapUI.js` | New `scrollToCell()` method |

## Risk

Medium. Camera panning could conflict with manual scrolling during battle (currently disabled via `setBattleMode`). Hero size change could cause overlap with cell borders.

Mitigation:
- Battle mode already disables manual scroll, so camera control is safe.
- `HERO_RADIUS` is only used for visual layout (HP bar position, float tween), not for collision or targeting logic. Confirmed by grep: no collision/targeting code references HERO_RADIUS.
- Pre-battle scroll state is stored and restored, avoiding jarring camera jumps.

## Verification

1. `npm run build` passes
2. Battle starts → map pans to center the combat cell
3. Hero moves to next cell → map follows smoothly
4. Battle ends → map returns to default scroll
5. Heroes are visibly larger (36px vs 24px)
6. Hero HP bars scale proportionally
7. Multiple heroes in same cell don't clip out of cell bounds excessively
