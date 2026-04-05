---
id: "037"
title: "Hitstop + Persistent Trap Visual Effects"
status: proposed
date: "2026-04-05"
specs_affected:
  - battle
depends_on: ["036"]
risk: low
---

# Proposal 037: Hitstop + Persistent Trap Visual Effects

## Why

Gemini comparison with Dungeon Maker identified two key visual gaps:
1. DM has brief "hit pause" (hitstop) on heavy attacks — we don't, making hits feel weightless
2. DM's trap effects persist on tiles (fire continues burning, ice stays frozen) — ours flash once and vanish

## What

### Part A: Hitstop (Hit Pause)
- When damage ≥ 30, pause battle logic for 50ms before continuing
- Visual: all movement/animation freezes for that instant, creating "weight"
- Implementation: BattleManager temporarily pauses `_active` flag for 50ms via scene timer

### Part B: Persistent Trap Visual Effects
- After trap triggers, leave a residual visual effect on the cell for 2-3 seconds:
  - Fire: subtle orange glow pulsing on cell (fillCircle with low alpha, pulse tween)
  - Frost: blue tint overlay on cell (rectangle with 0x66ccff, alpha 0.2)
  - Poison: green particles/dots floating up from cell
  - Arrow/Boulder: no persistent effect (instant damage traps)
- Effects auto-fade after 2.5 seconds

## Changes

### 1. `src/substates/BattleUI.js` — Hitstop (~10 lines)
- In `_onAttack`: if damage ≥ 30, call `this._battleManager.pauseForHitstop(50)`
- In `_onTrapTrigger`: if damage ≥ 20, call hitstop

### 2. `src/models/BattleManager.js` — `pauseForHitstop()` (~8 lines)
- Set `this._hitstopUntil = Date.now() + ms`
- In `update()`: skip tick if `Date.now() < this._hitstopUntil`

### 3. `src/substates/BattleUI.js` — Persistent trap effects (~25 lines)
- In `_onTrapTrigger`: after spawning instant VFX, also spawn persistent effect for fire/frost/poison
- Persistent effect: graphics object with low alpha, added to map container
- Auto-destroy via tween after 2500ms

## Affected Files

| File | Change |
|------|--------|
| `src/models/BattleManager.js` | pauseForHitstop method, hitstop check in update |
| `src/substates/BattleUI.js` | Hitstop calls, persistent trap VFX |

## Risk

Low. Hitstop is a brief pause (50ms max), won't break game logic. Persistent VFX are visual-only overlays.

## Verification

1. `npm run build` passes
2. Large damage hit → brief visual freeze (50ms), then continues
3. Fire trap triggers → orange glow persists on cell for ~2.5s
4. Frost trap triggers → blue tint overlay persists for ~2.5s
5. Poison trap → green dots float up for ~2.5s
6. Arrow/boulder → no persistent effect (unchanged)
7. Multiple traps on same cell don't stack visual artifacts excessively
