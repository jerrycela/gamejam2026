# Hero Special Traits — Design Spec (v2)

## Goal

Implement the `specialTrait` field already defined in heroes.json. Each hero gets a unique passive ability that activates automatically during battle, adding strategic depth to which heroes the player faces.

## Scope (Game Jam MVP)

Implement 4 of 5 playable hero traits. Defer priest's auto-shield (requires ally-targeting logic).

| hero | This phase | Deferred (P012+) |
|------|-----------|-------------------|
| trainee_swordsman | 10% trap parry | — |
| light_archer | first trap skip | +20% vs flying |
| fire_mage | 30% burn on skill | — |
| holy_knight | +35% vs undead | — |
| priest | — | auto-shield + 25% vs undead |

### 1. Trainee Swordsman — Trap Parry (10%)

- **Trigger:** When hero steps on a trap (`_resolveTrap`)
- **Effect:** 10% chance to completely negate trap damage AND skip debuff application
- **Implementation:** RNG check at top of `_resolveTrap`, return `{ damage: 0, status: 'parried' }`
- **Visual:** Caller emits `trapParry` event (not `trapTrigger`) → BattleUI shows "Parry!" popup in white

### 2. Light Archer — First Trap Skip

- **Trigger:** First trap encounter per battle (HeroInstance is battle-scoped, resets each battle)
- **Effect:** Automatically skip the first trap (no damage, no debuff)
- **Implementation:** `hero.traitState.firstTrapUsed` flag. Check in `_resolveTrap` — return `{ damage: 0, status: 'skipped' }`
- **Visual:** Caller emits `trapSkip` event (not `trapTrigger`) → BattleUI shows "Skip!" popup in cyan

### 3. Fire Mage — Burn on Skill Hit (30%)

- **Trigger:** When fire_mage's skill deals damage to a monster
- **Effect:** 30% chance to apply burn: 5 raw damage (no DEF reduction) per 1.5s for 3 ticks
- **Implementation:**
  - Add `burnState` to combat context: `{ damage: 5, ticksRemaining: 3, timer: 0 }`
  - Independent burn timer: `ctx.burnState.timer += dt`, ticks every 1500ms
  - Tick ordering: burn ticks AFTER monster attack, BEFORE hero death check
  - Refresh policy: re-proc overwrites (resets ticksRemaining), no stacking
  - Burn can kill monsters → check `monster.currentHp <= 0` after tick
  - Emit `burnDamage` event
- **Visual:** Orange damage popup `#e67e22` for burn ticks

### 4. Holy Knight — Anti-Undead Bonus (+35%)

- **Trigger:** When holy_knight attacks an undead-type monster (`monsterDef.type.includes('undead')`)
- **Effect:** +35% damage on both normal attacks and skills
- **Implementation:** In `_tickMonsterFight`, multiply damage by `trait.multiplier`. Emit attack event with `holyBonus: true` flag
- **Visual:** Golden damage popup `#ffd700`

### 5. Priest — Auto Shield (DEFERRED)

Too complex for MVP: requires tracking all alive heroes, finding lowest HP, applying absorb shield, 3-turn cooldown. Defer to P012+.

## Data Changes

### heroes.json — Add structured trait data

```json
// trainee_swordsman
"trait": { "id": "trap_parry", "chance": 0.1 }

// light_archer
"trait": { "id": "first_trap_skip" }

// fire_mage
"trait": { "id": "burn_on_skill", "chance": 0.3, "damage": 5, "ticks": 3 }

// holy_knight
"trait": { "id": "anti_undead", "multiplier": 1.35 }
```

## Code Changes

### HeroInstance.js

- Add `this.trait = def.trait || null`
- Add `this.traitState = {}` (per-battle mutable state)
- Initial keys: `first_trap_skip` → `{ firstTrapUsed: false }`, others → `{}`

### BattleManager.js

- `_resolveTrap`: Returns `{ damage, status }` object (was: number). Trait checks before damage calc.
- Caller (`_tickMoving`): emits `trapParry`/`trapSkip`/`trapTrigger` based on `status`
- `_tickMonsterFight`: holy_knight damage multiplier; burn proc on skill hit; burn tick with independent 1.5s timer

### BattleUI.js

- Listen to new events: `trapParry`, `trapSkip`, `burnDamage`
- Golden popup for holy bonus attacks: `#ffd700`
- Orange popup for burn damage: `#e67e22`
- "Parry!" and "Skip!" text popups (not numbers)

## Boss Fight Limitation

- Trap traits (parry, skip) work on path to boss (trap processing happens before boss cell)
- Combat traits (anti_undead, burn_on_skill) only in `_tickMonsterFight`, not in `_tickBossFight`. Boss is not a typed monster — this is an intentional MVP scope limitation.

## Not Doing

- No trait UI icons or descriptions in battle
- No priest auto-shield (deferred)
- No light_archer +20% vs flying (deferred)
- No trait upgrades or meta-progression interaction
- No new files — all changes in existing 4 files + heroes.json
