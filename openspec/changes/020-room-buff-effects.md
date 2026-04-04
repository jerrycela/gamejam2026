# Proposal 020 — Room Buff Effects in Battle (v2.1, approved)

**Status:** approved
**Author:** Claude (Opus 4.6)
**Priority:** High — core strategic mechanic defined in data but never applied
**Review:** Codex YES 84% / Gemini NO→YES 80% (P1=0, P2 resolved below)

## Why

`rooms.json` defines `buffTarget` + `buffEffect` for all 5 room types, but BattleManager never reads them. Only the narrower `preferredRoom` synergy (1:1 atkMultiplier) is active. Players place rooms but get zero tactical benefit from tag-based buffs.

## What

Apply room `buffEffect` to monsters during combat when any of the monster's `type` tags matches the cell's `room.buffTarget`.

### Buff mapping & formulas

| Room | buffTarget | JSON key | Effect | Formula |
|------|-----------|----------|--------|---------|
| dungeon | undead | `def` | 普攻減傷 | `roomDefMult = 1 + (def-1) * lvMult` |
| dungeon | undead | `hpRegen` | 每次怪物普攻命中時回血 | `regenAmt = round(hpRegen * lvMult)`, cap at maxHp |
| training | melee | `atk` | 攻擊力加成 | `roomAtkMult = 1 + (atk-1) * lvMult` |
| training | melee | `attackCdMultiplier` | 攻速加快 | `roomCdMult = 1 - (1-attackCdMultiplier) * lvMult` |
| hatchery | glutton | `atk` | 攻擊力加成 | `roomAtkMult = 1 + (atk-1) * lvMult` |
| lab | mage | `skillDamage` | 技能傷害加成 | `roomSkillMult = 1 + (skillDamage-1) * lvMult` |
| treasury | greedy | `skillDamage` | 技能傷害加成 | `roomSkillMult = 1 + (skillDamage-1) * lvMult` |

**Level multiplier (lvMult):** Lv1=1.0, Lv2=1.3, Lv3=1.6 (from rooms.json levels array).
**JSON keys preserved as-is** in rooms.json (`attackCdMultiplier` not renamed). `_getRoomBuff()` maps JSON keys to combat variables.

### rooms.json change

Treasury `buffEffect` changes from `{ "aoeRange": 1, "damageMultiplier": 1.2 }` to `{ "skillDamage": 1.2 }`.

### Combat formulas (complete)

```
# Monster normal attack damage
monsterAtk = round(baseAtk * synergyAtkMult * rosterAtkMult * roomAtkMult)
dmg = _resolveAttack(monsterAtk, heroDef)

# Monster receives hero normal attack
effectiveDef = round(baseDef * roomDefMult)
heroHitDmg = _resolveAttack(heroAtk, effectiveDef)

# Monster skill damage
skillDmg = round(baseSkillDmg * roomSkillMult)
(synergyEnhancedSkill replaces baseSkillDmg when active, then roomSkillMult on top)

# Monster attack cooldown
effectiveAttackCd = baseCd * roomCdMult

# HP regen (triggers each time monster lands a normal attack hit)
regenAmt = round(hpRegenValue * lvMult)
monster.currentHp = min(monster.currentHp + regenAmt, monster.maxHp)
```

### Monster maxHp field

Add `monster.maxHp` set in two places:
1. `GameState.setCellMonster()` — when placing: `maxHp = round(baseHp * rosterHpMult)`
2. `BattleManager._restoreMonsters()` — post-battle restore: same formula, also restores currentHp to maxHp

Schema: `monster: { instanceId, typeId, currentHp, maxHp, ... }`

### Visual indicator

DungeonMapUI: `showRoomBuffIndicators()` called from BattleUI when battle starts (setBattleMode), `hideRoomBuffIndicators()` when battle ends. Shows colored circle overlay on cells where monster has active room buff. Colors: dungeon=#6B8E9B, training=#C4956A, hatchery=#8BC49A, lab=#9B7BBF, treasury=#D4A844.

## Affected files

| File | Change |
|------|--------|
| `src/data/rooms.json` | Treasury buffEffect → `{ "skillDamage": 1.2 }` |
| `src/models/BattleManager.js` | Add `_getRoomBuff(cell, monsterDef)` helper; apply in `_tickMonsterFight`; set maxHp in `_restoreMonsters` |
| `src/models/GameState.js` | `setCellMonster()` sets maxHp |
| `src/substates/DungeonMapUI.js` | `showRoomBuffIndicators()` / `hideRoomBuffIndicators()` |
| `src/substates/BattleUI.js` | Call DungeonMapUI buff indicator methods on battle start/end |

## Verification

1. skeleton_knight in dungeon → hero normal attacks deal less damage (def buff) + monster regens HP on attack
2. goblin in training → faster attack speed (Lv1: 0.9x cd) + higher atk
3. Room Lv2 → training attackCd = 0.87x (faster, not 1.17x)
4. Synergy + room buff stack multiplicatively
5. hpRegen capped at monster.maxHp
6. Monster in non-matching room → no room buff
7. DungeonMapUI shows colored dot on buffed cells during battle, removed after
8. frost_witch in lab → skill damage boosted
