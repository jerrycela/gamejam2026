# Proposal 021 — Shop Data-Driven Prices + No Duplicates (v1.1, approved)

**Status:** approved
**Author:** Claude (Opus 4.6)
**Priority:** Medium — in-run shop has hardcoded prices ignoring item value
**Review:** Codex NO→YES 82% (P1=0, P2 resolved) / Gemini degraded (tool failure)

## Why

GameScene.openShop() hardcodes room price=100G, trap price=80G. A treasury (glamour 5) costs the same as a dungeon (glamour 2). Shop can also offer 3x the same item.

## What

1. Add `shopPrice` field to each room and trap in JSON (human-set prices, not formula-derived)
2. openShop reads price from data instead of hardcoding
3. Shop picks min(3, pool.length) unique items via shuffle
4. Show type label (房間/陷阱). No description (rooms.json lacks description field, out of scope).
5. Layout adapts to actual item count (totalW based on items.length)

### Pricing (human-set, balancing value + utility)

**Rooms:** dungeon=80, training=80, hatchery=120, lab=120, treasury=200
**Traps:** arrow=50, fire=80, frost=60, poison=70, boulder=100

## Affected files

| File | Change |
|------|--------|
| `src/data/rooms.json` | Add `shopPrice` to each entry |
| `src/data/traps.json` | Add `shopPrice` to each entry |
| `src/scenes/GameScene.js` | openShop: read shopPrice, shuffle unique selection, type label, dynamic layout |

## Verification

1. Room/trap prices match JSON shopPrice
2. No duplicate items in shop
3. Pool < 3 → show fewer items, centered
4. Buy button checks item-specific price
5. Gold deduction matches displayed price
6. Type label visible (房間/陷阱)
