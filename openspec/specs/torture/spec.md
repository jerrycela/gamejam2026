---
baseline_date: "2026-04-01"
last_modified: "2026-04-01"
version: "1.1"
---

# Torture — Torture Chamber (Pikmin Bloom Planter UI)

## Requirements

### Requirement: Torture Chamber Layout

The torture chamber SHALL be a full-screen UI resembling Pikmin Bloom's planter interface.

#### Scenario: Screen structure

WHEN the player opens the torture chamber
THEN the screen SHALL display:
- Title "刑求室" (gold, centered)
- 2-4 torture platform slots (circular, arranged in a grid)
- Unlock cost label on locked slots
- Prisoner staging area at the bottom (horizontal scrollable list)

---

### Requirement: Slot Management

Slots SHALL be unlockable by spending resources.

#### Scenario: Initial state

WHEN a new run begins
THEN 2 slots SHALL be unlocked (empty)
AND remaining slots SHALL be locked with escalating unlock costs (500, 1000 gold)
AND slot unlocks are **per-run only** (reset each new run, NOT meta-progression)

#### Scenario: Unlock a slot

WHEN a player taps a locked slot
AND has sufficient gold
THEN the slot SHALL unlock
AND the gold SHALL be deducted

---

### Requirement: Prisoner Assignment

Players SHALL drag prisoners from the staging area to open torture slots.

#### Scenario: Assign prisoner

WHEN a player drags a prisoner chip to an empty unlocked slot
THEN the prisoner SHALL be placed on the torture platform
AND the prisoner's sprite SHALL appear on the platform (desaturated, chained)
AND the conversion target number SHALL be displayed (based on hero strength)

#### Scenario: Prisoner extraction (榨取)

WHEN a player taps "榨取" on a prisoner in the staging area
THEN the prisoner SHALL be consumed
AND gold/resources SHALL be granted based on hero strength
AND the prisoner SHALL be removed from the staging area

---

### Requirement: Conversion Progress

Torture progress SHALL advance based on hero kills in battle.

#### Scenario: Progress advancement

WHEN a hero is killed during any battle
THEN ALL occupied torture slots SHALL advance their progress by 1
AND the progress bar SHALL update visually

#### Scenario: Conversion completion

WHEN a torture slot's progress reaches its target
THEN a conversion animation SHALL play (color shift bright→dark, flash)
AND the conversion SHALL unlock one of the existing base monsters (from the 5 defined in units/spec.md)
AND the unlocked monster SHALL be added to the player's available monster pool for the current run
AND the torture slot SHALL become empty (available for reuse)

---

### Requirement: Conversion Reward Mapping (MVP)

Conversion SHALL map hero types to existing base monsters, NOT create dynamic new monsters.

#### Scenario: Hero-to-monster mapping

| Captured Hero | Unlocks Monster | Reasoning |
|---------------|-----------------|-----------|
| 見習劍士 | 地精 | Melee → melee |
| 光弓獵手 | 蝙蝠魅魔 | Ranged → flying ranged |
| 神官 | 冰霜女巫 | Support/magic → mage |
| 火焰法師 | 暴躁惡魔 | Fire magic → fire melee |
| 聖騎士 | 骷髏劍士 | Holy tank → undead tank |

Additionally, the converted monster SHALL receive a **one-time stat buff** for the current run:
- +15% HP and ATK over base stats
- Marked as "Converted" in UI (darkened sprite tint)

Note: This is an MVP simplification. Future versions may support dynamic monster generation with inherited hero skills.
