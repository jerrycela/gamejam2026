---
id: "034"
title: "Room Buff Visibility — Strategic Placement Info"
status: applied
date: "2026-04-05"
specs_affected:
  - dungeon_map
depends_on: []
risk: low
---

# Proposal 034: Room Buff Visibility During Placement

## Why

Players can't see what buffs rooms provide when placing monsters. They must memorize room effects or trial-and-error, which kills strategic depth — the core gameplay loop of "place monster in right room" has no information feedback.

## What

### 1. Enhanced Cell Detail Popup

Enhance `_getCellPopupLines(cell)` to show (using `roomDef.name` / `monsterDef.name` instead of raw typeId):

- **Room name + level** (existing, but switch to `roomDef.name`)
- **Room buff info** (if `roomDef.buffEffect` exists):
  - "增益對象：[buffTarget readable name]"
  - "增益效果：[effective values after level multiplier]" — must align with `_getRoomBuff()` calculation
- **Monster name** (existing, switch to `monsterDef.name`)
- **Synergy status** (separate from buff, only if monster placed):
  - If `monster.preferredRoom === room.typeId`: "房型適性：適性加成! ATK x[multiplier]"
  - If enhanced skill exists: "+ [enhancedSkill.name]"
  - Otherwise: "房型適性：無"

Effective buff values must be calculated with room level multiplier, matching `_getRoomBuff()` logic:
```
level = cell.room.level || 1
lvMult = roomDef.levels[level-1].multiplier
effective_def = 1 + (buffEffect.def - 1) * lvMult  // e.g. Lv.2 dungeon: 1 + 0.3*1.3 = 1.39
```

### 2. Dynamic Popup Sizing

Make `_showCellPopup` height dynamic based on actual text content:
- Use Phaser text `wordWrap` with popup width - padding
- Calculate height from rendered text objects
- Min height 160px, content-driven expansion

### 3. Synergy-Aware Placement Highlights

Modify `_highlightValidCells()` when in monster placement mode:
- Cells with room matching selected monster's `preferredRoom`: **gold (0xffcc00) pulse**
- All other valid normal cells: **green (0x00ff44) pulse** (unchanged)
- Guard: if `roomDef.buffEffect` doesn't exist, treat as non-matching

## Changes

### `src/substates/DungeonMapUI.js`

| Method | Change | ~Lines |
|--------|--------|--------|
| `_getCellPopupLines(cell)` | Add buff/synergy info lines, use `.name` | +35 |
| `_showCellPopup(cell)` | Dynamic height, wordWrap | +8 |
| `_highlightValidCells()` | Gold vs green based on preferredRoom match | +12 |

## Risk

Low. Read-only data display. No game state or balance changes.

## Verification

1. `npm run build` passes
2. Tap cell with room+monster → popup shows room name, buff with effective values, synergy status
3. Tap cell with room but no monster → shows buff info, no synergy line
4. Tap cell with no room → shows "房間：空" (no buff/synergy lines)
5. Select monster from roster → matching room cells glow gold, others green
6. Room Lv.2+ displays correct effective values (not base values)

## Dual Review

- Codex: VERDICT NO → P1 resolved (level-adjusted values), P2s addressed
- Gemini: VERDICT YES (90%) → P2 interaction flow REJECTED (separate flows), P2 guard check PARTIAL (added)
