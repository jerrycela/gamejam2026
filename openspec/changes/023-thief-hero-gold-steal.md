# Proposal 023 — Thief Hero (Gold Steal) (v1.0, approved)

**Status:** approved (small — 1 JSON entry + ~10 lines logic)
**Author:** Claude (Opus 4.6)

## Why

All heroes are pure combat threats. A thief that steals gold adds economic pressure — players must defend not just their heart but their treasury. Changes defensive strategy.

## What

### New hero: 盜賊 (Thief)
```json
{
  "id": "thief",
  "name": "盜賊",
  "type": ["melee", "agile"],
  "baseHp": 55,
  "baseAtk": 15,
  "baseDef": 4,
  "attackCd": 1.3,
  "skill": null,
  "goldValue": 80,
  "specialTrait": "移動極快但脆弱。每通過一格偷取 15G，擊殺可奪回被偷金幣",
  "trait": { "id": "gold_steal", "amount": 15 },
  "spawnWeight": { "normal": 2, "elite": 3, "boss": 1 },
  "spriteKey": "hero_thief"
}
```

Design: fast (low attackCd but used for moving speed via low HP → dies fast or reaches heart fast), low stats, high goldValue reward if killed.

### Mechanic
- When thief arrives at any cell during movement, steal `trait.amount` gold from player (min 0)
- Track stolen gold on hero instance: `hero.stolenGold`
- When thief dies, return stolen gold to player (on top of normal goldValue)
- Emit `goldSteal` event for BattleUI to show popup
- Emit `goldReturn` when killed

### Implementation points in BattleManager
1. `_tickMoving` after heroArrive: check `hero.trait?.id === 'gold_steal'` → steal gold
2. `_heroDefeated`: return `hero.stolenGold` to player

### HeroInstance
Add `this.stolenGold = 0;` in constructor.

## Affected files

| File | Change |
|------|--------|
| `src/data/heroes.json` | Add thief entry |
| `src/models/HeroInstance.js` | Add `stolenGold = 0` |
| `src/models/BattleManager.js` | Gold steal in `_tickMoving`, gold return in `_heroDefeated` |
| `src/substates/BattleUI.js` | Handle `goldSteal`/`goldReturn` events with popups |

## Verification

1. Thief spawns in normal/elite battles
2. Moving through cells steals 15G each
3. Player gold cannot go below 0
4. Killing thief returns stolen gold + normal goldValue
5. Gold steal popup visible during battle
