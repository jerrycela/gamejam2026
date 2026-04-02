# P010 — Trap Special Effects

## Goal

Add differentiated trap effects (frost slow, poison DoT, fire AoE) to make trap placement strategically meaningful. Currently all traps deal flat damage only.

## Scope

Only 3 traps need effects: frost, poison, fire. Arrow and boulder already work correctly as pure damage traps.

## Data Layer (traps.json)

Add `effect` field to trap definitions:

| trap | effect | params |
|------|--------|--------|
| arrow | none | — |
| boulder | none | — |
| frost | `{ "type": "slow", "moveDurationMult": 2, "cellsRemaining": 3 }` | movement time x2 for 3 cells |
| poison | `{ "type": "dot", "tickDamage": 5, "cellsRemaining": 4 }` | 5 damage per cell move, 4 cells |
| fire | `{ "type": "aoe", "aoeRadius": 0 }` | same-cell AoE (MVP = single target, scaffolded for future) |

## Model Layer (BattleManager.js)

### Hero debuff structure

Hero objects gain a `debuffs` array. Each debuff entry:

```js
{ type: 'slow'|'dot', moveDurationMult?: number, tickDamage?: number, cellsRemaining: number }
```

### _resolveTrap changes

After applying base damage, read `trapDef.effect`:
- `effect.type === 'slow'`: push slow debuff onto hero.debuffs (overwrite if same type exists, keep longer duration)
- `effect.type === 'dot'`: push dot debuff onto hero.debuffs (overwrite if same type exists, keep longer duration)
- `effect.type === 'aoe'`: apply trap damage to all heroes currently in the same cell (via _cellCombatOwner or hero position tracking). MVP: since heroes enter cells one at a time, this behaves as single-target but the code path handles multiple.

### Movement speed integration

Current hero movement uses a fixed duration per cell. When a hero has a `slow` debuff:
- Movement duration = base duration * moveDurationMult
- After each cell move, decrement cellsRemaining; remove debuff at 0

### DoT integration

When a hero completes a cell move and has a `dot` debuff:
- Apply tickDamage as damage
- Emit 'dotDamage' event for UI popup
- Decrement cellsRemaining; remove debuff at 0
- If hero HP <= 0 from DoT, trigger _heroDefeated

### Debuff stacking rules

- Same type overwrites (no stacking), keeps the longer remaining duration
- Different types coexist (a hero can be slowed AND poisoned)

## UI Layer (BattleUI.js)

- Slowed hero: blue stroke ring (0x3498db) around hero circle
- Poisoned hero: green stroke ring (0x2ecc71) around hero circle
- DoT damage popup: green color text (instead of default red)
- No debuff icon or timer display

## Files Changed

1. `src/data/traps.json` — add effect fields
2. `src/models/BattleManager.js` — debuff logic in _resolveTrap, movement, tick
3. `src/substates/BattleUI.js` — debuff visual indicators + green popup

## Not Doing

- No debuff icon / timer UI
- No debuff stacking (same type overwrites)
- No hero resistance / immunity
- No new files or abstractions
- No changes to trap upgrade scaling (effect params are fixed, not level-dependent)

## Estimated Size

~100-150 lines changed across 3 files.
