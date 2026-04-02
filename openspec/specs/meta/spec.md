---
baseline_date: "2026-04-01"
last_modified: "2026-04-02"
version: "2.0"
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
- Boss level: 1

Note: Torture slots are per-run (always start with 2 open, 2 locked). They are NOT meta-progression.

#### Scenario: Unlock via Shop Purchase

Players SHALL unlock additional content by spending metaGold in the Boot Scene shop.

| ID | Type | Cost (metaGold) |
|----|------|-----------------|
| bat_succubus | monster | 300 |
| rage_demon | monster | 500 |
| frost_witch | monster | 400 |
| hatchery | room | 400 |
| lab | room | 350 |
| treasury | room | 600 |
| fire | trap | 250 |
| frost | trap | 200 |
| poison | trap | 300 |

Purchase is atomic: `MetaState.purchaseUnlock(type, id, cost)` checks balance, deducts metaGold, then unlocks — all or nothing.

#### Scenario: metaGold Economy

WHEN a run ends (victory or defeat)
THEN all remaining `gameState.gold` SHALL be converted to `metaGold` via `MetaState.finalizeRun(gameState, victory)`.

`finalizeRun` is idempotent (internal `_runFinalized` flag). `MetaState.beginRun()` resets the flag at the start of each new run (called by `GameScene.create()`).

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
- Room glamour values: treasury = 5, hatchery = 3, lab = 3, training = 2, dungeon = 2

#### Scenario: Glamour effect on hero generation

WHEN a battle card is flipped
THEN hero strength SHALL scale with glamour:
- Glamour 0-10: base hero stats
- Glamour 11-25: hero stats * 1.2, +1 hero count
- Glamour 26-50: hero stats * 1.5, +2 hero count, higher elite chance
- Glamour 50+: hero stats * 2.0, guaranteed elite, boss heroes in normal battles

---

### Requirement: localStorage Schema

#### Scenario: Save format (v2)

The localStorage key `dungeon_lord_meta` SHALL store a JSON object:
```json
{
  "version": 2,
  "bossLevel": 3,
  "totalRuns": 7,
  "metaGold": 1250,
  "unlockedMonsters": ["skeleton_knight", "goblin", "bat_succubus"],
  "unlockedRooms": ["dungeon", "training", "hatchery"],
  "unlockedTraps": ["arrow", "boulder", "frost"],
  "bestiary": {
    "heroes": { "trainee_swordsman": true, "light_archer": true },
    "monsters": { "skeleton_knight": true, "goblin": true }
  }
}
```

#### Scenario: Default seed values

WHEN no localStorage data exists
THEN MetaState SHALL initialize with:
- `version`: 2
- `bossLevel`: 1
- `totalRuns`: 0
- `metaGold`: 0
- `unlockedMonsters`: ["skeleton_knight", "goblin"]
- `unlockedRooms`: ["dungeon", "training"]
- `unlockedTraps`: ["arrow", "boulder"]
- `bestiary`: { heroes: {}, monsters: {} }

#### Scenario: Data migration

WHEN the saved version is older than the current version
THEN the game SHALL migrate the data:
- v1→v2: add `metaGold: 0`
- All numeric fields validated with `Number.isFinite()`, invalid values fallback to 0
- `metaGold` clamped to `Math.max(0, value)` (prevent negative)
- Never delete existing fields
