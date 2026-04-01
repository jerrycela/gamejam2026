---
baseline_date: "2026-04-01"
last_modified: "2026-04-01"
version: "1.0"
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
AND remaining slots SHALL be locked with escalating unlock costs

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
AND the hero SHALL transform into an evil-aligned monster
AND the new monster SHALL be added to the player's available monster pool
AND the torture slot SHALL become empty (available for reuse)

---

### Requirement: Converted Monster Properties

Converted heroes SHALL retain partial hero abilities.

#### Scenario: Monster from converted hero

WHEN a hero completes conversion
THEN the resulting monster SHALL have:
- Base stats derived from the original hero (60% of hero stats)
- One skill inherited from the hero's skillset
- A visual that is the hero's sprite with darkened/corrupted color palette
- A "Converted" tag in the bestiary
