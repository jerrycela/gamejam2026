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

**finalBattle** card: remains injected face-up on Day 3+ with escalating probability. When finalBattle appears, it replaces one non-battle card as before. Since there are no more battle cards in the pool, the replacement target is any card. finalBattle is the ONLY battle-type card that can appear in the matrix.

### 2. Draw Cost — 5 Free Per Day

Each day the player gets **5 free flips**. After that, flips cost gold with escalating prices.

Replace the current `drawCosts.json` array `[0, 50, 100, ...]` with:
- Flips 1-5: free (0 gold)
- Flip 6+: cost from `[50, 100, 150, 250, 350, 500]` (index = drawCount - 5)
- Cap at last value (500) for any further draws

Update the "抽卡" button label:
- When free draws remain: `抽卡 [免費] (N/5)`
- When paid: `抽卡 [XXG]`

The matrix is still fixed at 15 cards. "Flipping" means revealing a face-down card (same as now). No extra cards are generated beyond the 15-card matrix. Once all 15 are flipped, the flip phase is complete — no paid flips beyond the matrix.

### 3. Monster Card — Pick 1 of 3

When a monster card is flipped:

1. Show a selection panel (similar to shop layout) with **3 candidate monsters**
2. Candidates drawn from unlocked monster pool (via MetaState)
3. Star rating per candidate uses existing weights: 1-star 70%, 2-star 25%, 3-star 5%
4. Each candidate shows: sprite, name, type tags, base stats, preferred room
5. Player taps one to recruit — monster added to `gameState.monsterRoster`
6. Panel closes, flip matrix continues

If fewer than 3 monster types are unlocked, show all available (minimum 1).

**Star rating and monster stats:** Star rating affects the monster's combat effectiveness. Currently monsters have flat base stats. For simplicity in this iteration, star rating applies a multiplier to monster HP and ATK: 1-star = 1.0x, 2-star = 1.3x, 3-star = 1.6x. This is stored on the monster instance as `starRating` and applied during battle calculations in BattleManager.

### 4. Dungeon Map — "Start Battle" Button

Replace the automatic battle trigger with a player-initiated flow:

**UI Change:**
- Always visible on dungeon map tab: `迎戰 Day N` button
- Button position: top-right area of the map viewport, styled as a red call-to-action
- Button disabled (grayed) if `hasAnyDefense() === false` — label changes to "至少部署一隻怪物" in smaller font

**Flow:**
1. Player taps "迎戰 Day N"
2. Confirmation toast: "英雄來襲！" (1000ms)
3. Battle starts (reuses current battle logic from BattleManager/BattleUI)
4. On battle end → show result banner → advance day → return to flip matrix

**Day advancement is ONLY triggered by:**
- Completing a battle via the "迎戰" button → `advanceDay()` → next day flip matrix

**finalBattle does NOT advance the day** — it ends the entire run via `_endRun()` → ResultScene, as defined in P008. finalBattle is a run-ending event, not a day-progression event.

There is no other way to advance the day. The player must fight via "迎戰" to progress to the next day.

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

- Stat multiplier applies to HP and ATK only (not DEF or attackCd)
- Glamour scaling is REPLACED by day scaling, not stacked. `finalMult = dayMult` only. This prevents the exponential blowup from double-multiplying. Glamour can be repurposed later if needed.
- Hero count is randomized within the range shown (uniform)

### 6. Affected Files

| File | Change |
|------|--------|
| `src/utils/constants.js` | Remove battle card weights, add monster weight + color, add `HERO_DAY_SCALING` table, add `FREE_DRAW_COUNT = 5` |
| `src/data/drawCosts.json` | Update cost array for post-free draws |
| `src/models/FlipMatrixGenerator.js` | Remove battle types from pool, add monster type |
| `src/substates/FlipEventHandler.js` | Add `_handleMonster()` with pick-1-of-3 panel, remove battle-card handling, simplify day-advance logic |
| `src/substates/FlipMatrixUI.js` | Update card visuals for monster type (purple, monster icon) |
| `src/substates/DungeonMapUI.js` | Add "迎戰 Day N" button UI |
| `src/models/BattleManager.js` | Refactor `_generateHeroes()` to use `HERO_DAY_SCALING` table, remove glamour stacking |
| `src/models/GameState.js` | Track `freeDrawsUsed` per day, reset on `advanceDay()` |
| `src/scenes/GameScene.js` | Wire "迎戰" button to BattleManager + BattleUI, handle post-battle day advance + flip matrix reset |

### 7. What Does NOT Change

- Final battle injection (Day 3+ probability) — unchanged
- Room/trap card system — unchanged (still from draw/抽卡)
- Monster deployment UX (P049) — unchanged
- Battle mechanics (BattleManager combat logic) — unchanged
- Torture/capture system — unchanged
- Meta progression / unlock system — unchanged

### 8. Risk

**Medium-High** — Rewires core game loop across 9 files including progression, economy, and pacing. Each individual change reuses existing patterns (card selection panel similar to shop, button similar to popup), but the interconnected nature requires careful integration testing.

### 9. Verification

1. Day 1: Flip matrix has 15 cards, none are battle type. First 5 flips free, flips 6-15 cost gold (escalating). No flips possible beyond the 15-card matrix.
2. Flip a monster card → 3 candidates shown with star ratings → pick one → appears in monster roster with correct starRating
3. Switch to map → "迎戰 Day 1" button visible but grayed (no defense)
4. Place room + deploy monster → button becomes active (red)
5. Tap "迎戰 Day 1" → battle with 2 basic heroes at 1.0x stats → win → Day 2 flip matrix
6. Day 5: Battle spawns 4 heroes including holy_knight with 1.5x HP/ATK
7. Day 3+: finalBattle card may appear face-up, tapping it triggers final battle as before
8. No way to advance day without fighting
