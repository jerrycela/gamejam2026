---
id: "041"
title: "Monster Placement Ghost Preview + Room Name Labels"
status: applied
date: "2026-04-05"
specs_affected:
  - dungeon_map
depends_on: ["034"]
risk: low
---

# Proposal 041: Monster Placement Ghost Preview

## Why

When selecting a monster from roster, players see highlighted cells but can't visualize what the placement will look like. They also can't quickly identify which room each cell has without tapping. DM shows ghost previews during placement.

## What

### 1. Room Name Labels on Cells (already implemented, fast path)

Show small room name text at bottom of each cell with a room. Uses existing `_getCellLabel()` method.

### 2. Ghost Monster Preview During Placement

When in monster placement mode (`selectionState.mode === 'monster'`), show a semi-transparent (alpha 0.3) monster sprite on every valid empty cell. This lets players:
- See what the monster would look like in each position
- Compare scale/visual against existing monsters

**Only on empty cells** — cells with existing monsters already show their sprite.

## Changes

### `src/substates/DungeonMapUI.js`

| Method | Change | ~Lines |
|--------|--------|--------|
| `_buildCellContainer(cell)` | Add room name label text (done) | +8 |
| `_highlightValidCells()` | Spawn ghost sprites on empty cells when in monster mode | +15 |
| `_clearPlacementHighlights()` | Destroy ghost sprites | +5 |

**Ghost sprite implementation:**
```js
// In _highlightValidCells, after setting highlight border color:
if (monsterDef && !cell.monster) {
  const ghostKey = `monster_${monster.typeId}`;
  const ghost = SpriteHelper.createSprite(scene, ghostKey, 0, 0, MONSTER_SIZE);
  ghost.setAlpha(0.3);
  cont.add(ghost);
  cont.setData('ghostSprite', ghost);
}
```

**Cleanup in _clearPlacementHighlights:**
```js
const ghost = cont.getData('ghostSprite');
if (ghost) { ghost.destroy(); cont.setData('ghostSprite', null); }
```

## Risk

Low. Visual-only change during placement mode. Sprites are cleaned up on mode exit.

## Verification

1. `npm run build` passes
2. Select monster from roster → empty valid cells show semi-transparent monster sprite
3. Place monster or cancel → ghost sprites removed
4. Cells with existing monsters don't get ghost sprites
5. Room name labels visible on all cells with rooms
