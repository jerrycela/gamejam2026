---
id: "039"
title: "Battle MVP Report — Best/Worst Cell Highlight"
status: applied
date: "2026-04-05"
specs_affected:
  - battle
depends_on: ["035"]
risk: low
---

# Proposal 039: Battle MVP Report

## Why

Per-cell stats overlay (P035) shows raw numbers after battle, but players must mentally compare all cells. The core loop (place -> battle -> **learn** -> improve) breaks at the learn step.

## What

After battle ends, on top of existing per-cell stats:

### 1. MVP/Weakest Cell Highlights (static border, no pulse)

Only compare **monster cells with positive output** (damage + trapDamage > 0 AND cell has monster):
```js
const entries = Object.entries(cellStats)
  .filter(([cellId, s]) => {
    const cell = gameState.getCell(cellId);
    return cell?.monster && (s.damage + s.trapDamage > 0);
  });
if (entries.length < 2) return; // nothing to compare
entries.sort((a, b) => (b[1].damage + b[1].trapDamage) - (a[1].damage + a[1].trapDamage));
const mvpCellId = entries[0][0];
// Weakest: only if score differs from MVP (tie = don't mark weakest)
const weakCellId = entries[entries.length - 1];
const mvpScore = entries[0][1].damage + entries[0][1].trapDamage;
const weakScore = weakCellId[1].damage + weakCellId[1].trapDamage;
if (mvpScore === weakScore) weakCellId = null; // all tied, no weakest
```

- **MVP cell**: gold (0xffd700) static border via `setCellHighlight` + "MVP" text badge above cell
- **Weakest cell**: red (0xff4444) static border + "!" text badge above cell
- Badges: `scene.add.text()` positioned at cell top, added to `_transients` for cleanup

### 2. Extended Result Banner with Summary

Expand existing battle result banner from 280x100 to 280x140:
- Add third line below existing subtitle: "MVP: [monsterName] ([totalDmg]) | 最低: [monsterName] ([totalDmg])"
- Monster name from `dataManager.getMonster(cell.monster.typeId).name`
- If no weakest (tied): show only "MVP: [name] ([dmg])"
- Extend hold time from 1.2s to 3s so players can read

### Cleanup

All new visual objects (badges, highlight borders) added to `this._transients[]`. Existing `stop()` cleanup already destroys transients and calls `clearBattleHighlights()`.

## Changes

### `src/substates/BattleUI.js`

| Method | Change | ~Lines |
|--------|--------|--------|
| `_showCellStatsOverlay(cellStats)` | Add MVP/weakest static highlight + text badges | +20 |
| `_onBattleEnd(data, session)` | Expand banner to 280x140, add summary line, extend hold to 3s | +15 |

## Risk

Low. Visual overlay only, no game state changes.

## Verification

1. `npm run build` passes
2. 2+ monster combat cells: MVP gets gold border + "MVP" badge, weakest gets red + "!"
3. All cells tied: only MVP shown, no weakest
4. Single combat cell: no MVP/weakest highlighting
5. Banner shows monster names and damage, visible for 3s
6. All overlays cleaned up after battle UI dismissed

## Dual Review

- Codex: VERDICT NO (45%) -> 3 P1s resolved: pulse->static, filter monster-only cells, define as lowest-positive-output
- Gemini: VERDICT YES (80%) -> P2s addressed: transients cleanup, badge implementation, tie handling
