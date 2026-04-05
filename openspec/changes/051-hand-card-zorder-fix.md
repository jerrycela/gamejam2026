# P051: Hand Card Hit Zone Z-Order Fix

**Status:** proposed
**Type:** fix
**Risk:** low

## Why

Hand area cards are unresponsive to tap — `_handZone` (touch isolation layer) sits above `_handAreaContainer` in `_rootContainer` z-order. Phaser's `topOnly` input means `_handZone` intercepts all pointerdown events before card hitZones can receive them.

This is the root cause of "clicking cards doesn't build rooms / place monsters".

## What

Two changes in `DungeonMapUI`:

1. In `_buildHandInput()`, insert `_handZone` into `_rootContainer` **before** `_handAreaContainer` (lower z-order) using `addAt()`. Card hitZones then receive events first; misses fall through to `_handZone` which still prevents map scroll.

2. In `_rebuildHand()` card hitZone pointerdown handler, also set `this._isHandTouch = true` to preserve scroll isolation when drag starts on a card (Codex review feedback).

## Affected Files

- `src/substates/DungeonMapUI.js` — `_buildHandInput()` + `_rebuildHand()` (~5 line change)

## Verification

1. Tap a card in hand area → card highlights with gold border, mode text changes
2. Tap a map cell → room/trap placed successfully
3. Tap empty hand area (not on card) → map does NOT scroll
4. Popup still works (z-order unaffected — popupContainer is above both)
