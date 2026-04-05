# P053: Core Loop Redesign — Resource Flipping + Manual Battle

## Why

The current flip matrix has 50% battle cards (normalBattle 30 + eliteBattle 15 + bossBattle 5). Players often flip into battles on Day 1 before dungeon defenses are ready. This creates a frustrating experience where outcomes depend on luck rather than strategy. Additionally, the monster acquisition path is unclear — players don't have an intuitive way to build their monster roster.

## Core Loop (New)

```
Flip Phase → Build Phase → Battle Phase → Next Day
(get resources)  (place rooms/monsters)  (player-initiated)
```

## Changes

### 1. Flip Matrix — Pure Resource Cards

Remove all battle card types from the weighted pool:
- ~~normalBattle (30)~~
- ~~eliteBattle (15)~~
- ~~bossBattle (5)~~

Add new **monster** card type. New weights:

| Type | Weight | Description |
|------|--------|-------------|
| monster | 25 | Pick 1 of 3 monsters |
| activity | 25 | Random event |
| treasure | 15 | Gold/items |
| shop | 10 | Buy rooms/traps |

Total weight: 75 (renormalized automatically by weighted random).

**finalBattle** remains unchanged — injected face-up on Day 3+ with escalating probability.

### 2. Draw Cost — 5 Free Per Day

Each day the player gets **5 free flips**. After that, flips cost gold with escalating prices.

Replace the current `drawCosts.json` array `[0, 50, 100, ...]` with:
- Flips 1-5: free (0 gold)
- Flip 6+: cost from `[50, 100, 150, 250, 350, 500]` (index = drawCount - 5)
- Cap at last value (500) for any further draws

Update the "抽卡" button label:
- When free draws remain: `抽卡 [免費] (N/5)`
- When paid: `抽卡 [XXG]`

### 3. Monster Card — Pick 1 of 3

When a monster card is flipped:

1. Show a selection panel (similar to shop layout) with **3 candidate monsters**
2. Candidates drawn from unlocked monster pool (via MetaState)
3. Star rating per candidate uses existing weights: 1-star 70%, 2-star 25%, 3-star 5%
4. Each candidate shows: sprite, name, type tags, base stats, preferred room
5. Player taps one to recruit — monster added to `gameState.monsterRoster`
6. Panel closes, flip matrix continues

If fewer than 3 monster types are unlocked, show all available (minimum 1).

### 4. Dungeon Map — "Start Battle" Button

Replace the automatic battle trigger with a player-initiated flow:

**UI Change:**
- After all 15 cards are resolved (or any time), show a prominent button on the dungeon map: `迎戰 Day N`
- Button position: top-right area of the map viewport, styled as a red call-to-action
- Button disabled (grayed) if `hasAnyDefense() === false` — tooltip: "至少部署一隻怪物"

**Flow:**
1. Player taps "迎戰 Day N"
2. Confirmation toast: "英雄來襲！" (1000ms)
3. Battle starts (same as current `_handleBattle` logic)
4. On battle end → show result banner → advance day → return to flip matrix

**Important:** Player can also continue flipping (paid) even after matrix complete, before initiating battle. This allows accumulating resources across multiple flip rounds before fighting.

### 5. Hero Difficulty Curve — Quantity Then Quality

Replace the current flat hero generation with a day-scaled system:

| Day | Hero Count | Pool | Stat Multiplier |
|-----|-----------|------|-----------------|
| 1 | 2 | trainee_swordsman, light_archer, thief | 1.0x |
| 2 | 2-3 | same as Day 1 | 1.0x |
| 3 | 3 | + priest, fire_mage | 1.15x |
| 4 | 3-4 | same as Day 3 | 1.3x |
| 5 | 4 | + holy_knight | 1.5x |
| 6 | 4-5 | same as Day 5 | 1.75x |
| 7+ | 5 | + hero_of_legend | 2.0x |

- Stat multiplier applies to HP and ATK (not DEF or attackCd)
- Glamour scaling still applies on top: `finalMult = dayMult * (1 + glamour/500)`
- Hero count is randomized within the range shown

### 6. Affected Files

| File | Change |
|------|--------|
| `src/utils/constants.js` | Remove battle card weights, add monster weight, add `HERO_DAY_SCALING` config, update `FREE_DRAW_COUNT` |
| `src/data/drawCosts.json` | Update cost array for post-free draws |
| `src/models/FlipMatrixGenerator.js` | Remove battle types from pool, add monster type |
| `src/substates/FlipEventHandler.js` | Add `_handleMonster()`, remove `_handleBattle()` calls for flip triggers, remove auto day-advance-triggers-battle |
| `src/substates/FlipMatrixUI.js` | Update card visuals for monster type (icon, color) |
| `src/substates/DungeonMapUI.js` | Add "迎戰 Day N" button + battle trigger flow |
| `src/models/BattleManager.js` | Refactor hero generation to use day-scaled config |
| `src/models/GameState.js` | Track `freeDrawsUsed` per day, reset on `advanceDay()` |
| `src/scenes/GameScene.js` | Wire battle button to BattleManager, handle post-battle day advance |

### 7. What Does NOT Change

- Final battle injection (Day 3+ probability) — unchanged
- Room/trap card system — unchanged (still from draw/抽卡)
- Monster deployment UX (P049) — unchanged
- Battle mechanics (BattleManager combat) — unchanged
- Torture/capture system — unchanged
- Meta progression — unchanged

### 8. Risk

**Medium** — Touches core game loop across 8+ files. However, each change is mechanically straightforward (weight changes, UI additions, config tables). No new systems — reuses existing patterns (card selection panel similar to shop, button similar to existing popup).

### 9. Verification

1. Day 1: Flip 5 cards for free, 6th costs gold. No battle cards appear.
2. Flip a monster card → 3 candidates shown → pick one → appears in monster roster
3. Place room + deploy monster on map → "迎戰 Day 1" button active
4. Tap button → battle starts with 2 basic heroes → win → Day 2 flip matrix
5. Day 5+: Battle spawns 4 heroes including holy_knight with 1.5x stats
6. Final battle still appears face-up on Day 3+
