---
id: "034"
title: "Room Buff Visibility — Strategic Placement Info"
status: proposed
date: "2026-04-05"
specs_affected:
  - dungeon_map
depends_on: []
risk: low
---

# Proposal 034: Room Buff Visibility During Placement

## Why

Players can't see what buffs rooms provide when placing monsters. They must memorize room effects or trial-and-error, which kills strategic depth — the core gameplay loop of "place monster in right room" has no information feedback.

Gemini analysis confirmed: "佈陣資訊不透明 — 玩家不知道放哪裡最好" is a top gameplay issue.

## What

Enhance the cell detail popup (`_getCellPopupLines`) to show:
1. Room buff description (what the room does, who it buffs)
2. Monster-room synergy status (match/mismatch)
3. Synergy bonus details when matched (ATK multiplier, enhanced skill name)

Also: when selecting a monster from roster, highlight cells with matching rooms (green pulse on compatible cells).

## Changes

### 1. `src/substates/DungeonMapUI.js` — `_getCellPopupLines(cell)` (~30 lines)

Currently shows only: room typeId + level, trap typeId + level, monster typeId + HP.

Add after room line:
- Room buff description: "增益：[target] [effect details]"
- If monster is placed: synergy status ("適性加成!" or "無適性")
- If synergy active: show multiplier and enhanced skill name

### 2. `src/substates/DungeonMapUI.js` — `_showCellPopup(cell)` (~5 lines)

Increase popup height dynamically based on line count (current fixed 200px too small for extra info).

### 3. `src/substates/DungeonMapUI.js` — monster placement highlights (~15 lines)

When player selects a monster from roster, in addition to current green cell highlights, add a special glow on cells whose room matches the monster's preferredRoom.

## Affected Files

| File | Change |
|------|--------|
| `src/substates/DungeonMapUI.js` | Enhance popup content, dynamic height, synergy highlights |

## Risk

Low. Read-only data display changes. No game logic or state modifications.

## Verification

1. `npm run build` passes
2. Tap a cell with room+monster → popup shows buff description and synergy status
3. Tap a cell with room but no monster → popup shows buff description, "適性：[target type]"
4. Tap a cell with no room → popup shows "房間：空" (unchanged)
5. Select monster from roster → cells with matching rooms have distinct highlight
