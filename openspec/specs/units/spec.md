---
baseline_date: "2026-04-01"
last_modified: "2026-04-01"
version: "1.0"
---

# Units — Monsters, Heroes, Rooms, Traps (Data)

## Requirements

### Requirement: Monster Definitions

5 base monsters SHALL be defined in `data/monsters.json`.

#### Scenario: Monster data schema

Each monster entry SHALL contain:
```json
{
  "id": "skeleton_knight",
  "name": "骷髏劍士",
  "type": ["undead", "melee"],
  "preferredRoom": "dungeon",
  "baseHp": 120,
  "baseAtk": 25,
  "baseDef": 15,
  "attackCd": 2.0,
  "skill": {
    "name": "猛劈",
    "type": "single",
    "damage": 35,
    "cd": 5.0,
    "description": "對單一英雄造成物理傷害"
  },
  "synergyBonus": {
    "atkMultiplier": 1.3,
    "enhancedSkill": {
      "name": "亡靈猛劈",
      "damage": 50,
      "description": "在地牢中強化：傷害提升並附帶減防效果"
    }
  },
  "spriteKey": "monster_skeleton"
}
```

#### Scenario: Full monster roster

| ID | Name | Types | Preferred Room | Skill |
|----|------|-------|----------------|-------|
| skeleton_knight | 骷髏劍士 | undead, melee | 地牢 | 猛劈 (single) |
| bat_succubus | 蝙蝠魅魔 | greedy, flying | 寶藏室 | 魅惑尖叫 (AoE) |
| rage_demon | 暴躁惡魔 | glutton, melee | 孵化室 | 嘔吐攻擊 |
| frost_witch | 冰霜女巫 | mage, ice | 研究室 | 極寒領域 (AoE slow+dmg) |
| goblin | 地精 | melee, physical | 訓練室 | 致命突刺 (single high dmg) |

---

### Requirement: Hero Definitions

5 hero types SHALL be defined in `data/heroes.json`.

#### Scenario: Hero data schema

Each hero entry SHALL contain: id, name, type, baseHp, baseAtk, baseDef, attackCd, skill, specialTrait, spawnWeight (by battle type), spriteKey.

#### Scenario: Full hero roster

| ID | Name | Types | Spawn | Special |
|----|------|-------|-------|---------|
| trainee_swordsman | 見習劍士 | melee, balanced | normal | None |
| light_archer | 光弓獵手 | ranged, physical | normal | Skips first trap, attacks back-row |
| priest | 神官 | support, holy | normal/elite | Heals allies, reduces poison/dark |
| fire_mage | 火焰法師 | ranged, fire | elite | AoE magic, fire resist, ice weakness |
| holy_knight | 聖騎士 | melee, tank | elite/boss | High HP/DEF, bonus vs undead |

---

### Requirement: Room Definitions

5 room types SHALL be defined in `data/rooms.json`.

#### Scenario: Room data schema

Each room entry SHALL contain: id, name, buffTarget (monster trait that benefits), buffEffect (stat multipliers), glamourValue, runeIcon (SVG path or key), levels (array of stat scaling per level).

#### Scenario: Full room roster

| ID | Name | Buff Target | Effect |
|----|------|-------------|--------|
| hatchery | 孵化室 | glutton | ATK +30% |
| lab | 研究室 | mage | Skill damage +30% |
| training | 訓練室 | melee | ATK +25%, CD -10% |
| dungeon | 地牢 | undead | DEF +30%, HP regen |
| treasury | 寶藏室 | greedy | AoE range +1, damage +20% |

---

### Requirement: Trap Definitions

5 trap types SHALL be defined in `data/traps.json`.

#### Scenario: Full trap roster

| ID | Name | Effect | Base Damage |
|----|------|--------|-------------|
| arrow | 箭矢陷阱 | Physical damage | 20 |
| fire | 焚燒陷阱 | Fire AoE damage | 30 |
| frost | 冰霜陷阱 | Ice damage + slow 3 turns | 15 |
| poison | 毒沼陷阱 | Poison DoT (5 dmg x 4 turns) | 5/tick |
| boulder | 落石機關 | Single high-damage trigger | 60 |

Traps SHALL scale with level (damage increases per level).
