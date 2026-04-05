# P052: Monster Defeat VFX Ghost Lines Fix

**Status:** applied
**Type:** fix
**Risk:** low

## Why

When a monster is defeated during battle, `setCellHighlight(cellId, 0x00ff44)` draws a green highlight border, then clears it via `setVisible(false)` after 300ms. However, the Graphics object's command buffer is not cleared — on CANVAS renderer (especially mobile), this leaves ghost vertical line artifacts on the map.

## What

In `DungeonMapUI.setCellHighlight()`, call `highlightBorder.clear()` when hiding (color === null), not just `setVisible(false)`. This ensures the Graphics command buffer is empty and no ghost rendering occurs.

## Affected Files

- `src/substates/DungeonMapUI.js` — `setCellHighlight()` method (1 line addition)

## Verification

1. Start battle with monsters deployed
2. Let hero defeat a monster — green flash should appear briefly then disappear cleanly
3. No ghost green/orange vertical lines should remain on map after battle
