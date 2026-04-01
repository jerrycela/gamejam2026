---
baseline_date: "2026-04-01"
last_modified: "2026-04-01"
version: "1.0"
---

# Meta — Meta-Progression & localStorage

## Requirements

### Requirement: Persistent Unlocks

The game SHALL track which content the player has unlocked across runs.

#### Scenario: Initial unlock state (first play)

WHEN a player starts the game for the first time (no localStorage)
THEN the following SHALL be available:
- Monsters: skeleton_knight, goblin (2 of 5)
- Rooms: dungeon, training (2 of 5)
- Traps: arrow, boulder (2 of 5)
- Torture slots: 2
- Boss level: 1

#### Scenario: Unlock progression

WHEN a run ends
THEN new unlocks SHALL be granted based on:
- Runs completed: unlock milestones at run 2, 4, 6, 8, 10
- Boss level: certain monsters/rooms require minimum boss level
- Bestiary entries: encountering a hero type unlocks related content

---

### Requirement: Boss Level Scaling

The boss (dungeon heart) SHALL scale with meta-progression.

#### Scenario: Boss stat scaling

GIVEN bossLevel = N
THEN boss base HP SHALL be: 100 + (N - 1) * 20
AND boss base ATK SHALL be: 15 + (N - 1) * 5
AND boss skill cooldown reduction: max(10 - N * 0.5, 5) seconds

---

### Requirement: Glamour (華麗度) System

Glamour SHALL be a derived stat that affects incoming hero strength.

#### Scenario: Glamour calculation

WHEN the dungeon state changes (room built/upgraded)
THEN glamour SHALL be recalculated as:
- Sum of all room levels * room glamour value
- Each room type has a base glamour value (e.g., treasury = 5, hatchery = 2)

#### Scenario: Glamour effect on hero generation

WHEN a battle card is flipped
THEN hero strength SHALL scale with glamour:
- Glamour 0-10: base hero stats
- Glamour 11-25: hero stats * 1.2, +1 hero count
- Glamour 26-50: hero stats * 1.5, +2 hero count, higher elite chance
- Glamour 50+: hero stats * 2.0, guaranteed elite, boss heroes in normal battles

---

### Requirement: localStorage Schema

#### Scenario: Save format

The localStorage key `dungeon_lord_meta` SHALL store a JSON object:
```json
{
  "version": 1,
  "bossLevel": 3,
  "totalRuns": 7,
  "unlockedMonsters": ["skeleton_knight", "goblin", "bat_succubus"],
  "unlockedRooms": ["dungeon", "training", "hatchery"],
  "unlockedTraps": ["arrow", "boulder", "frost"],
  "bestiary": {
    "heroes": { "trainee_swordsman": true, "light_archer": true },
    "monsters": { "skeleton_knight": true, "goblin": true }
  }
}
```

#### Scenario: Data migration

WHEN the saved version is older than the current version
THEN the game SHALL migrate the data (add new fields with defaults, never delete)
